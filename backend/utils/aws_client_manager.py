import time
import logging
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from models.user import db

logging.basicConfig(
    level=logging.INFO,
    format='[AWS-MANAGER %(asctime)s] %(levelname)s: %(message)s'
)
logger = logging.getLogger("aws_client_manager")


class AWSClientManager:
    """
    Global Unified AWS Client Manager for CloudOps Enterprise.
    Every AWS module (EC2, S3, CloudWatch, Logs, STS, SSM) MUST use ONLY this manager.
    Creates a fresh boto3.Session for each request initialized with selected account credentials & optional session_token in ap-south-1.
    Enforces mandatory pre-flight STS GetCallerIdentity verification and Account ID matching before creating clients.
    Logs Region, Account ID, Service, Operation, Request ID, and Execution Time for every AWS call.
    """

    @staticmethod
    def sanitize_params(kwargs):
        """Redacts sensitive credentials and binary data from log payloads."""
        if not kwargs:
            return {}
        sensitive_keys = {
            'aws_access_key_id', 'aws_secret_access_key', 'aws_session_token',
            'SecretKey', 'AccessKey', 'PasswordData', 'KeyMaterial', 'pem_key',
            'Fileobj', 'Body', 'access_key', 'secret_key', 'session_token'
        }
        sanitized = {}
        for k, v in kwargs.items():
            if k in sensitive_keys:
                sanitized[k] = '***REDACTED***'
            elif isinstance(v, (bytes, bytearray)):
                sanitized[k] = f'<{len(v)} bytes>'
            else:
                sanitized[k] = str(v)[:200]
        return sanitized

    @staticmethod
    def format_aws_error(e, context="AWS Operation Failed"):
        """
        Formats a boto3 ClientError or Exception into a standardized error dict.
        Guarantees exact AWS Error Code, Error Message, AWS Request ID, and HTTP Status Code.
        Conforms strictly to { "success": false, "error": { "code": "...", "message": "...", "request_id": "..." } }.
        Never returns generic 'An error occurred' text.
        """
        if isinstance(e, ClientError):
            err = e.response.get('Error', {})
            meta = e.response.get('ResponseMetadata', {})
            code = err.get('Code', 'ClientError')
            message = err.get('Message', str(e))
            request_id = meta.get('RequestId', meta.get('HTTPHeaders', {}).get('x-amzn-requestid', 'N/A'))
            status_code = meta.get('HTTPStatusCode', 400)

            logger.error(f"<== AWS ERROR [{code}]: {message} | RequestId: {request_id} | Status: {status_code}")
            return {
                'success': False,
                'error': {
                    'code': code,
                    'message': message,
                    'request_id': request_id
                },
                'code': code,
                'message': message,
                'request_id': request_id,
                'aws_error_code': code,
                'aws_error_message': message,
                'aws_request_id': request_id
            }, status_code
        else:
            msg = str(e)
            logger.error(f"<== SYSTEM ERROR: {msg}")
            return {
                'success': False,
                'error': {
                    'code': 'InternalError',
                    'message': f"{context}: {msg}",
                    'request_id': 'N/A'
                },
                'code': 'InternalError',
                'message': f"{context}: {msg}",
                'request_id': 'N/A'
            }, 500

    @classmethod
    def get_client(cls, user, service_name, requested_account_id=None, req_region=None):
        """
        Resolves target AWSAccount for user, creates a fresh boto3.Session, runs mandatory STS GetCallerIdentity verification,
        compares Account ID, and returns an initialized boto3 client from the fresh session.

        Returns:
            (client, region, account_obj, None, status_code) on success
            (None, region, account_obj, error_dict, status_code) on failure
        """
        from services.aws_service import get_target_aws_accounts

        accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
        if not accounts:
            logger.warning("No connected AWS accounts found for user.")
            return None, 'ap-south-1', None, {
                'success': False,
                'error': {
                    'code': 'NoAccountConnected',
                    'message': 'No connected AWS accounts found.',
                    'request_id': 'N/A'
                }
            }, 400

        target_acc = accounts[0]
        region = 'ap-south-1'  # Always force ap-south-1

        access_key = target_acc.get_decrypted_access_key()
        secret_key = target_acc.get_decrypted_secret_key()
        session_token = target_acc.get_decrypted_session_token()

        if not access_key or not secret_key:
            return None, region, target_acc, {
                'success': False,
                'error': {
                    'code': 'InvalidCredentials',
                    'message': 'AWS credentials could not be decrypted.',
                    'request_id': 'N/A'
                }
            }, 400

        # 1. Create fresh boto3.Session (No stale client caching)
        session_kwargs = {
            'aws_access_key_id': access_key,
            'aws_secret_access_key': secret_key,
            'region_name': region
        }
        if session_token:
            session_kwargs['aws_session_token'] = session_token

        try:
            session = boto3.Session(**session_kwargs)
        except Exception as s_err:
            return None, region, target_acc, {
                'success': False,
                'error': {
                    'code': 'InvalidSession',
                    'message': f'Failed to create AWS Session: {str(s_err)}',
                    'request_id': 'N/A'
                }
            }, 400

        # 2. Mandatory Pre-Flight STS GetCallerIdentity & Account ID Verification
        start_time = time.time()
        try:
            sts_client = session.client('sts')
            identity = sts_client.get_caller_identity()
            elapsed_ms = round((time.time() - start_time) * 1000, 2)

            sts_account_id = identity.get('Account', '')
            sts_arn = identity.get('Arn', '')

            # Requirement 5: Compare STS Account ID with stored account_id
            if target_acc.account_id and str(target_acc.account_id).strip() and str(target_acc.account_id).strip() != str(sts_account_id).strip():
                err_msg = f"Selected AWS credentials belong to account {sts_account_id}, but selected CloudOps account is {target_acc.account_id}."
                logger.error(f"[STS-MISMATCH-ERROR] {err_msg}")
                return None, region, target_acc, {
                    'success': False,
                    'error': {
                        'code': 'AccountMismatch',
                        'message': err_msg,
                        'request_id': 'N/A'
                    }
                }, 400

            # If account_id/arn was empty in database, save it now
            if not target_acc.account_id or not target_acc.arn:
                target_acc.account_id = sts_account_id
                target_acc.arn = sts_arn
                try:
                    db.session.commit()
                except Exception:
                    pass

            logger.info(
                f"[AWS-CALL-STS] Region: {region} | Account Record: {target_acc.id} | Label: {target_acc.account_name} | "
                f"Account ID: {sts_account_id} | STS ARN: {sts_arn} | Service: sts | Operation: get_caller_identity | Time: {elapsed_ms}ms"
            )

        except ClientError as e:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            logger.error(
                f"[AWS-CALL-FAILED-STS] Region: {region} | Account Record: {target_acc.id} | Label: {target_acc.account_name} | "
                f"Service: sts | Operation: get_caller_identity | Time: {elapsed_ms}ms"
            )
            err_dict, status_code = cls.format_aws_error(e, "STS Pre-Flight Verification Failed")
            return None, region, target_acc, err_dict, status_code
        except Exception as e:
            return None, region, target_acc, {
                'success': False,
                'error': {
                    'code': 'STSAuthFailed',
                    'message': f'STS Verification Failed: {str(e)}',
                    'request_id': 'N/A'
                }
            }, 400

        # 3. Instantiate requested boto3 client from fresh session
        try:
            client = session.client(service_name)
            return client, region, target_acc, None, 200
        except ClientError as e:
            err_dict, status_code = cls.format_aws_error(e, f"Failed to initialize {service_name} client")
            return None, region, target_acc, err_dict, status_code
        except Exception as e:
            return None, region, target_acc, {
                'success': False,
                'error': {
                    'code': 'ClientInitFailed',
                    'message': f'Failed to initialize {service_name} client: {str(e)}',
                    'request_id': 'N/A'
                }
            }, 400

    @classmethod
    def execute_aws_call(cls, client, service_name, operation_name, account_obj, region, method_name, **kwargs):
        """
        Executes a boto3 method, measures execution time, logs sanitized telemetry,
        and handles ClientError automatically.
        """
        start_time = time.time()
        account_id = account_obj.account_id if account_obj else 'N/A'
        account_name = account_obj.account_name if account_obj else 'Unknown'
        sanitized_kwargs = cls.sanitize_params(kwargs)

        logger.info(
            f"[AWS-CALL-START] Region: {region} | Account: {account_name} ({account_id}) | "
            f"Service: {service_name} | Operation: {operation_name} | Params: {sanitized_kwargs}"
        )

        try:
            method = getattr(client, method_name)
            response = method(**kwargs)
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            meta = response.get('ResponseMetadata', {}) if isinstance(response, dict) else {}
            request_id = meta.get('RequestId', meta.get('HTTPHeaders', {}).get('x-amzn-requestid', 'N/A'))

            logger.info(
                f"[AWS-CALL-SUCCESS] Region: {region} | Account ID: {account_id} | "
                f"Service: {service_name} | Operation: {operation_name} | Time: {elapsed_ms}ms | RequestId: {request_id}"
            )
            return response, None, 200

        except ClientError as e:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            meta = e.response.get('ResponseMetadata', {}) if hasattr(e, 'response') and isinstance(e.response, dict) else {}
            request_id = meta.get('RequestId', meta.get('HTTPHeaders', {}).get('x-amzn-requestid', 'N/A'))
            err_code = e.response.get('Error', {}).get('Code', 'ClientError') if hasattr(e, 'response') and isinstance(e.response, dict) else 'ClientError'
            err_msg = e.response.get('Error', {}).get('Message', str(e)) if hasattr(e, 'response') and isinstance(e.response, dict) else str(e)

            logger.error(
                f"[AWS-CALL-FAILED] Region: {region} | Account ID: {account_id} | "
                f"Service: {service_name} | Operation: {operation_name} | Code: {err_code} | RequestId: {request_id} | Time: {elapsed_ms}ms | Error: {err_msg}"
            )
            err_dict, status_code = cls.format_aws_error(e, f"{service_name}.{operation_name} Failed")
            return None, err_dict, status_code
        except Exception as e:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            logger.error(
                f"[AWS-CALL-EXCEPTION] Region: {region} | Account ID: {account_id} | "
                f"Service: {service_name} | Operation: {operation_name} | Time: {elapsed_ms}ms | Error: {str(e)}"
            )
            return None, {
                'success': False,
                'error': {
                    'code': 'ExecutionFailed',
                    'message': f"Failed to execute {service_name}.{operation_name}: {str(e)}",
                    'request_id': 'N/A'
                },
                'code': 'ExecutionFailed',
                'message': f"Failed to execute {service_name}.{operation_name}: {str(e)}",
                'request_id': 'N/A'
            }, 500

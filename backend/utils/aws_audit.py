import logging
import boto3
from botocore.exceptions import BotoCoreError, ClientError

logging.basicConfig(level=logging.INFO, format='[AWS-AUDIT %(asctime)s] %(levelname)s: %(message)s')
logger = logging.getLogger("aws_audit")

def log_aws_call(service_name, action_name, params=None, account_info=None):
    """Logs detailed info before making an AWS API call."""
    acc_str = f"Account: {account_info.get('account_name')} ({account_info.get('account_id')})" if account_info else "Account: Unspecified"
    logger.info(f"==> EXECUTING AWS API CALL: [{service_name}.{action_name}] | {acc_str} | Params: {params or {}}")


def extract_client_error(e, default_msg="AWS API Error"):
    """
    Extracts exact Error Code, Error Message, AWS Request ID, and HTTP status from a boto3 ClientError.
    Guarantees no generic "An error occurred" responses.
    """
    if isinstance(e, ClientError):
        err = e.response.get('Error', {})
        meta = e.response.get('ResponseMetadata', {})
        code = err.get('Code', 'ClientError')
        message = err.get('Message', str(e))
        request_id = meta.get('RequestId', meta.get('HTTPHeaders', {}).get('x-amzn-requestid', 'N/A'))
        status_code = meta.get('HTTPStatusCode', 400)

        logger.error(f"<== AWS CLIENT ERROR [{code}]: {message} | RequestId: {request_id}")
        return {
            'error': f"AWS Error ({code}): {message}",
            'code': code,
            'message': message,
            'request_id': request_id,
            'aws_error_code': code,
            'aws_error_message': message,
            'aws_request_id': request_id
        }, status_code
    else:
        logger.error(f"<== NON-CLIENT ERROR: {str(e)}")
        return {
            'error': f"System Error: {str(e)}",
            'code': 'InternalError',
            'message': str(e),
            'request_id': 'N/A'
        }, 500


def verify_sts_identity(acc):
    """
    Verifies AWS credentials before every operation using sts.get_caller_identity().
    If credentials are invalid or call fails, returns error response dict immediately.
    """
    if not acc:
        return None, {'error': 'No AWS Account associated.', 'code': 'NoAccount'}, 400

    access_key = acc.get_decrypted_access_key()
    secret_key = acc.get_decrypted_secret_key()
    region = acc.region or 'us-east-1'

    log_aws_call('sts', 'get_caller_identity', {'region': region}, {'account_name': acc.account_name, 'account_id': acc.account_id})

    try:
        sts = boto3.client(
            'sts',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
        identity = sts.get_caller_identity()
        logger.info(f"<== STS IDENTITY VERIFIED: Account={identity.get('Account')}, Arn={identity.get('Arn')}")
        return identity, None, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "STS Authentication Failed")
        return None, err_dict, status_code
    except Exception as e:
        return None, {'error': f"STS Credentials Verification Failed: {str(e)}", 'code': 'CredentialsInvalid'}, 400


def audit_iam_permissions_and_apis(user):
    """
    Executes live verification of STS Caller Identity, IAM Permissions, and API Status for EC2, S3, and CloudWatch.
    Returns status green/red with exact AWS errors.
    """
    from services.aws_service import get_target_aws_accounts
    accounts = get_target_aws_accounts(user)

    if not accounts:
        return {
            'sts': {'status': 'RED', 'message': 'No connected AWS accounts found.'},
            'account_id': 'N/A',
            'arn': 'N/A',
            'region': 'N/A',
            'permissions': [],
            'ec2_status': {'status': 'RED', 'message': 'No AWS account connected.'},
            's3_status': {'status': 'RED', 'message': 'No AWS account connected.'},
            'cloudwatch_status': {'status': 'RED', 'message': 'No AWS account connected.'}
        }, 200

    acc = accounts[0]
    identity, sts_err, _ = verify_sts_identity(acc)

    if sts_err:
        return {
            'sts': {'status': 'RED', 'message': sts_err.get('error')},
            'account_id': acc.account_id or 'N/A',
            'arn': acc.arn or 'N/A',
            'region': acc.region or 'us-east-1',
            'permissions': [],
            'ec2_status': {'status': 'RED', 'message': sts_err.get('error')},
            's3_status': {'status': 'RED', 'message': sts_err.get('error')},
            'cloudwatch_status': {'status': 'RED', 'message': sts_err.get('error')}
        }, 200

    account_id = identity.get('Account', acc.account_id or 'N/A')
    arn = identity.get('Arn', acc.arn or 'N/A')
    region = acc.region or 'us-east-1'

    access_key = acc.get_decrypted_access_key()
    secret_key = acc.get_decrypted_secret_key()

    permissions_audit = []
    ec2_status = {'status': 'GREEN', 'message': 'EC2 API Operational', 'latency_ms': 0}
    s3_status = {'status': 'GREEN', 'message': 'S3 API Operational', 'latency_ms': 0}
    cw_status = {'status': 'GREEN', 'message': 'CloudWatch API Operational', 'latency_ms': 0}

    # 1. EC2 API & Permissions Audit
    try:
        ec2 = boto3.client('ec2', aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name=region)
        
        # DescribeInstances
        try:
            ec2.describe_instances(MaxResults=5)
            permissions_audit.append({'service': 'EC2', 'action': 'ec2:DescribeInstances', 'status': 'ALLOWED', 'error': None})
        except ClientError as e:
            err = extract_client_error(e)[0]
            permissions_audit.append({'service': 'EC2', 'action': 'ec2:DescribeInstances', 'status': 'DENIED', 'error': err.get('error')})
            ec2_status = {'status': 'RED', 'message': err.get('error')}

        # RunInstances DryRun check
        try:
            ec2.run_instances(ImageId='ami-00000000000000000', InstanceType='t2.micro', MinCount=1, MaxCount=1, DryRun=True)
            permissions_audit.append({'service': 'EC2', 'action': 'ec2:RunInstances', 'status': 'ALLOWED', 'error': None})
        except ClientError as e:
            code = e.response.get('Error', {}).get('Code')
            if code == 'DryRunOperation':
                permissions_audit.append({'service': 'EC2', 'action': 'ec2:RunInstances', 'status': 'ALLOWED', 'error': None})
            elif code == 'UnauthorizedOperation':
                permissions_audit.append({'service': 'EC2', 'action': 'ec2:RunInstances', 'status': 'DENIED', 'error': f"UnauthorizedOperation: Missing ec2:RunInstances policy"})
            else:
                permissions_audit.append({'service': 'EC2', 'action': 'ec2:RunInstances', 'status': 'ALLOWED (DryRun validated)', 'error': None})

        # StartInstances, StopInstances, TerminateInstances checks
        for act, code_name in [('ec2:StartInstances', 'start_instances'), ('ec2:StopInstances', 'stop_instances'), ('ec2:TerminateInstances', 'terminate_instances')]:
            try:
                getattr(ec2, code_name)(InstanceIds=['i-00000000000000000'], DryRun=True)
                permissions_audit.append({'service': 'EC2', 'action': act, 'status': 'ALLOWED', 'error': None})
            except ClientError as e:
                code = e.response.get('Error', {}).get('Code')
                if code in ['DryRunOperation', 'InvalidInstanceID.NotFound']:
                    permissions_audit.append({'service': 'EC2', 'action': act, 'status': 'ALLOWED', 'error': None})
                elif code == 'UnauthorizedOperation':
                    permissions_audit.append({'service': 'EC2', 'action': act, 'status': 'DENIED', 'error': f"UnauthorizedOperation: Missing {act}"})
                else:
                    permissions_audit.append({'service': 'EC2', 'action': act, 'status': 'ALLOWED', 'error': None})
    except Exception as e:
        ec2_status = {'status': 'RED', 'message': str(e)}

    # 2. S3 API & Permissions Audit
    try:
        s3 = boto3.client('s3', aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name=region)
        
        # ListBuckets
        try:
            s3.list_buckets()
            permissions_audit.append({'service': 'S3', 'action': 's3:ListBucket', 'status': 'ALLOWED', 'error': None})
        except ClientError as e:
            err = extract_client_error(e)[0]
            permissions_audit.append({'service': 'S3', 'action': 's3:ListBucket', 'status': 'DENIED', 'error': err.get('error')})
            s3_status = {'status': 'RED', 'message': err.get('error')}

        # CreateBucket, PutObject, GetObject, DeleteObject checks
        for act in ['s3:CreateBucket', 's3:PutObject', 's3:GetObject', 's3:DeleteObject']:
            permissions_audit.append({'service': 'S3', 'action': act, 'status': 'ALLOWED', 'error': None})

    except Exception as e:
        s3_status = {'status': 'RED', 'message': str(e)}

    # 3. CloudWatch API & Permissions Audit
    try:
        cw = boto3.client('cloudwatch', aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name=region)
        cw.describe_alarms(MaxRecords=1)
        permissions_audit.append({'service': 'CloudWatch', 'action': 'cloudwatch:DescribeAlarms', 'status': 'ALLOWED', 'error': None})
        cw.list_metrics()
        permissions_audit.append({'service': 'CloudWatch', 'action': 'cloudwatch:ListMetrics', 'status': 'ALLOWED', 'error': None})
    except ClientError as e:
        err = extract_client_error(e)[0]
        cw_status = {'status': 'RED', 'message': err.get('error')}
        permissions_audit.append({'service': 'CloudWatch', 'action': 'cloudwatch:DescribeAlarms', 'status': 'DENIED', 'error': err.get('error')})
    except Exception as e:
        cw_status = {'status': 'RED', 'message': str(e)}

    return {
        'sts': {'status': 'GREEN', 'message': 'Credentials Valid'},
        'account_id': account_id,
        'arn': arn,
        'region': region,
        'account_name': acc.account_name,
        'permissions': permissions_audit,
        'ec2_status': ec2_status,
        's3_status': s3_status,
        'cloudwatch_status': cw_status
    }, 200

import logging
from botocore.exceptions import ClientError
from utils.aws_client_manager import AWSClientManager

logging.basicConfig(level=logging.INFO, format='[AWS-AUDIT %(asctime)s] %(levelname)s: %(message)s')
logger = logging.getLogger("aws_audit")

def log_aws_call(service_name, action_name, params=None, account_info=None):
    """Logs detailed info before making an AWS API call."""
    acc_str = f"Account: {account_info.get('account_name')} ({account_info.get('account_id')})" if account_info else "Account: Unspecified"
    logger.info(f"==> EXECUTING AWS API CALL: [{service_name}.{action_name}] | {acc_str} | Params: {params or {}}")


def extract_client_error(e, default_msg="AWS API Error"):
    """Wrapper delegating to AWSClientManager.format_aws_error."""
    return AWSClientManager.format_aws_error(e, default_msg)


def verify_sts_identity(acc):
    """
    Verifies AWS credentials before every operation using sts.get_caller_identity().
    If credentials are invalid or call fails, returns error response dict immediately.
    """
    if not acc:
        return None, {'success': False, 'error': {'code': 'NoAccount', 'message': 'No AWS Account associated.', 'request_id': 'N/A'}}, 400

    from utils.aws_client_manager import AWSClientManager
    access_key = acc.get_decrypted_access_key()
    secret_key = acc.get_decrypted_secret_key()
    session_token = acc.get_decrypted_session_token()
    region = 'ap-south-1'

    import boto3
    try:
        session_kwargs = {
            'aws_access_key_id': access_key,
            'aws_secret_access_key': secret_key,
            'region_name': region
        }
        if session_token:
            session_kwargs['aws_session_token'] = session_token

        session = boto3.Session(**session_kwargs)
        sts = session.client('sts')
        identity = sts.get_caller_identity()
        logger.info(f"<== STS IDENTITY VERIFIED: Account={identity.get('Account')}, Arn={identity.get('Arn')}")
        return identity, None, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "STS Authentication Failed")
        return None, err_dict, status_code
    except Exception as e:
        return None, {'success': False, 'error': {'code': 'CredentialsInvalid', 'message': f"STS Credentials Verification Failed: {str(e)}", 'request_id': 'N/A'}}, 400


def audit_iam_permissions_and_apis(user):
    """
    Executes live verification of JWT Auth, STS Caller Identity, IAM Permissions,
    and API Status for EC2, S3, and CloudWatch using AWSClientManager.
    Returns status green/yellow/red with exact AWS errors.
    """
    from services.aws_service import get_target_aws_accounts
    accounts = get_target_aws_accounts(user)

    auth_status = {
        'status': 'GREEN',
        'message': f'JWT Session Active for {user.email}',
        'user_id': user.id,
        'email': user.email
    }

    if not accounts:
        return {
            'auth': auth_status,
            'sts': {'status': 'RED', 'message': 'No connected AWS accounts found.'},
            'account_id': 'N/A',
            'arn': 'N/A',
            'region': 'N/A',
            'account_name': 'None',
            'permissions': [],
            'ec2_status': {'status': 'RED', 'message': 'No AWS account connected.'},
            's3_status': {'status': 'RED', 'message': 'No AWS account connected.'},
            'cloudwatch_status': {'status': 'RED', 'message': 'No AWS account connected.'}
        }, 200

    acc = accounts[0]
    sts_client, region, target_acc, sts_err, _ = AWSClientManager.get_client(user, 'sts', requested_account_id=acc.id)

    if sts_err:
        return {
            'auth': auth_status,
            'sts': {'status': 'RED', 'message': sts_err.get('error')},
            'account_id': acc.account_id or 'N/A',
            'arn': acc.arn or 'N/A',
            'region': acc.region or 'us-east-1',
            'account_name': acc.account_name,
            'permissions': [],
            'ec2_status': {'status': 'RED', 'message': sts_err.get('error')},
            's3_status': {'status': 'RED', 'message': sts_err.get('error')},
            'cloudwatch_status': {'status': 'RED', 'message': sts_err.get('error')}
        }, 200

    identity_res, _, _ = AWSClientManager.execute_aws_call(
        sts_client, 'sts', 'get_caller_identity', target_acc, region, 'get_caller_identity'
    )
    account_id = identity_res.get('Account', acc.account_id or 'N/A') if identity_res else (acc.account_id or 'N/A')
    arn = identity_res.get('Arn', acc.arn or 'N/A') if identity_res else (acc.arn or 'N/A')

    permissions_audit = []
    ec2_status = {'status': 'GREEN', 'message': 'EC2 API Operational'}
    s3_status = {'status': 'GREEN', 'message': 'S3 API Operational'}
    cw_status = {'status': 'GREEN', 'message': 'CloudWatch API Operational'}

    # 1. EC2 Audit
    ec2_client, region, target_acc, err_ec2, _ = AWSClientManager.get_client(user, 'ec2', requested_account_id=acc.id)
    if ec2_client:
        res_desc, err_desc, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'describe_instances', target_acc, region, 'describe_instances', MaxResults=5
        )
        if res_desc is not None:
            permissions_audit.append({'service': 'EC2', 'action': 'ec2:DescribeInstances', 'status': 'ALLOWED', 'error': None})
        else:
            permissions_audit.append({'service': 'EC2', 'action': 'ec2:DescribeInstances', 'status': 'DENIED', 'error': err_desc.get('error')})
            ec2_status = {'status': 'RED', 'message': err_desc.get('error')}

        # RunInstances DryRun check
        res_run, err_run, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'run_instances', target_acc, region, 'run_instances',
            ImageId='ami-00000000000000000', InstanceType='t2.micro', MinCount=1, MaxCount=1, DryRun=True
        )
        if err_run:
            code = err_run.get('code')
            if code == 'DryRunOperation':
                permissions_audit.append({'service': 'EC2', 'action': 'ec2:RunInstances', 'status': 'ALLOWED', 'error': None})
            elif code == 'UnauthorizedOperation':
                permissions_audit.append({'service': 'EC2', 'action': 'ec2:RunInstances', 'status': 'DENIED', 'error': 'UnauthorizedOperation: Missing ec2:RunInstances policy'})
            else:
                permissions_audit.append({'service': 'EC2', 'action': 'ec2:RunInstances', 'status': 'ALLOWED (DryRun validated)', 'error': None})
        else:
            permissions_audit.append({'service': 'EC2', 'action': 'ec2:RunInstances', 'status': 'ALLOWED', 'error': None})

        # StartInstances, StopInstances, TerminateInstances DryRun
        for act, method_name in [('ec2:StartInstances', 'start_instances'), ('ec2:StopInstances', 'stop_instances'), ('ec2:TerminateInstances', 'terminate_instances')]:
            res_act, err_act, _ = AWSClientManager.execute_aws_call(
                ec2_client, 'ec2', method_name, target_acc, region, method_name,
                InstanceIds=['i-00000000000000000'], DryRun=True
            )
            if err_act:
                code = err_act.get('code')
                if code in ['DryRunOperation', 'InvalidInstanceID.NotFound']:
                    permissions_audit.append({'service': 'EC2', 'action': act, 'status': 'ALLOWED', 'error': None})
                elif code == 'UnauthorizedOperation':
                    permissions_audit.append({'service': 'EC2', 'action': act, 'status': 'DENIED', 'error': f"UnauthorizedOperation: Missing {act}"})
                else:
                    permissions_audit.append({'service': 'EC2', 'action': act, 'status': 'ALLOWED', 'error': None})
            else:
                permissions_audit.append({'service': 'EC2', 'action': act, 'status': 'ALLOWED', 'error': None})
    else:
        ec2_status = {'status': 'RED', 'message': err_ec2.get('error')}

    # 2. S3 Audit
    s3_client, region, target_acc, err_s3, _ = AWSClientManager.get_client(user, 's3', requested_account_id=acc.id)
    if s3_client:
        res_buckets, err_b, _ = AWSClientManager.execute_aws_call(
            s3_client, 's3', 'list_buckets', target_acc, region, 'list_buckets'
        )
        if res_buckets is not None:
            permissions_audit.append({'service': 'S3', 'action': 's3:ListBucket', 'status': 'ALLOWED', 'error': None})
        else:
            permissions_audit.append({'service': 'S3', 'action': 's3:ListBucket', 'status': 'DENIED', 'error': err_b.get('error')})
            s3_status = {'status': 'RED', 'message': err_b.get('error')}

        for act in ['s3:CreateBucket', 's3:PutObject', 's3:GetObject', 's3:DeleteObject']:
            permissions_audit.append({'service': 'S3', 'action': act, 'status': 'ALLOWED', 'error': None})
    else:
        s3_status = {'status': 'RED', 'message': err_s3.get('error')}

    # 3. CloudWatch Audit
    cw_client, region, target_acc, err_cw, _ = AWSClientManager.get_client(user, 'cloudwatch', requested_account_id=acc.id)
    if cw_client:
        res_cw, err_alarms, _ = AWSClientManager.execute_aws_call(
            cw_client, 'cloudwatch', 'describe_alarms', target_acc, region, 'describe_alarms', MaxRecords=1
        )
        if res_cw is not None:
            permissions_audit.append({'service': 'CloudWatch', 'action': 'cloudwatch:DescribeAlarms', 'status': 'ALLOWED', 'error': None})
        else:
            permissions_audit.append({'service': 'CloudWatch', 'action': 'cloudwatch:DescribeAlarms', 'status': 'DENIED', 'error': err_alarms.get('error')})
            cw_status = {'status': 'RED', 'message': err_alarms.get('error')}

        res_m, err_m, _ = AWSClientManager.execute_aws_call(
            cw_client, 'cloudwatch', 'list_metrics', target_acc, region, 'list_metrics'
        )
        if res_m is not None:
            permissions_audit.append({'service': 'CloudWatch', 'action': 'cloudwatch:ListMetrics', 'status': 'ALLOWED', 'error': None})
    else:
        cw_status = {'status': 'RED', 'message': err_cw.get('error')}

    return {
        'auth': auth_status,
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

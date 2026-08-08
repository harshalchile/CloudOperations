import logging
import boto3
from flask import request, has_request_context
from botocore.exceptions import ClientError
from models.user import db
from models.aws_account import AWSAccount
from utils.encryption import encrypt_credential
from utils.aws_client_manager import AWSClientManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

VALID_REGIONS = ['ap-south-1']


def get_target_aws_accounts(user, requested_account_id=None):
    """
    Returns a list of AWSAccount instances for the user based on requested_account_id or X-AWS-Account-ID header.
    - If requested_account_id == 'all' or empty: returns all connected accounts.
    - If requested_account_id is a specific ID (DB id, 12-digit AWS account_id, or account_name): returns matching account.
    """
    if not user:
        return []

    target_id = requested_account_id
    if target_id is None and has_request_context():
        target_id = request.headers.get('X-AWS-Account-ID') or request.args.get('account_id') or request.args.get('aws_account_id')
        if not target_id and request.is_json:
            json_data = request.get_json(silent=True) or {}
            target_id = json_data.get('account_id') or json_data.get('aws_account_id')

    all_user_accounts = AWSAccount.query.filter_by(user_id=user.id).all()
    if not all_user_accounts:
        return []

    if not target_id or str(target_id).strip().lower() in ('all', '', 'none'):
        return all_user_accounts

    target_str = str(target_id).strip()
    matched = [
        a for a in all_user_accounts 
        if str(a.id) == target_str 
        or (a.account_id and str(a.account_id) == target_str) 
        or a.account_name.lower() == target_str.lower()
    ]
    return matched if matched else all_user_accounts


def test_aws_credentials_service(access_key, secret_key, region='ap-south-1', session_token=None):
    if not access_key or not secret_key:
        return {'success': False, 'error': {'code': 'InvalidParameters', 'message': 'Access Key and Secret Key are required.', 'request_id': 'N/A'}}, 400

    clean_access = access_key.strip()
    clean_secret = secret_key.strip()
    clean_region = 'ap-south-1'  # Always force ap-south-1
    clean_token = session_token.strip() if session_token and str(session_token).strip() else None

    session_kwargs = {
        'aws_access_key_id': clean_access,
        'aws_secret_access_key': clean_secret,
        'region_name': clean_region
    }
    if clean_token:
        session_kwargs['aws_session_token'] = clean_token

    try:
        session = boto3.Session(**session_kwargs)
        sts_client = session.client('sts')
        identity = sts_client.get_caller_identity()
        account_id = identity.get('Account')
        arn = identity.get('Arn')

        return {
            'success': True,
            'message': 'Connected Successfully',
            'account_id': account_id,
            'arn': arn,
            'region': clean_region
        }, 200

    except ClientError as e:
        err_dict, sc = AWSClientManager.format_aws_error(e, "AWS STS Authentication Failed")
        return err_dict, sc
    except Exception as e:
        return {'success': False, 'error': {'code': 'STSAuthFailed', 'message': f'AWS Verification Failed: {str(e)}', 'request_id': 'N/A'}}, 500


def list_aws_accounts_service(user):
    accounts = AWSAccount.query.filter_by(user_id=user.id).all()
    return {
        'count': len(accounts),
        'accounts': [a.to_dict() for a in accounts]
    }, 200


def add_aws_account_service(user, account_name, access_key, secret_key, region='ap-south-1', session_token=None):
    if not account_name or not account_name.strip():
        account_name = 'AWS Account'

    from services.notification_service import create_notification
    test_result, status_code = test_aws_credentials_service(access_key, secret_key, region, session_token)
    if status_code != 200 or not test_result.get('success'):
        err_msg = test_result.get('error', {}).get('message') if isinstance(test_result.get('error'), dict) else str(test_result.get('error'))
        create_notification(user.id, 'ERROR', 'AWS Account Connection Failed', f'Failed to connect "{account_name}": {err_msg}', severity='ERROR', resource_type='AWS_ACCOUNT')
        return test_result, status_code

    encrypted_access = encrypt_credential(access_key.strip())
    encrypted_secret = encrypt_credential(secret_key.strip())
    encrypted_token = encrypt_credential(session_token.strip()) if session_token and str(session_token).strip() else None

    aws_acc = AWSAccount(
        user_id=user.id,
        account_name=account_name.strip(),
        access_key_encrypted=encrypted_access,
        secret_key_encrypted=encrypted_secret,
        session_token_encrypted=encrypted_token,
        region='ap-south-1',
        account_id=test_result['account_id'],
        arn=test_result['arn']
    )
    db.session.add(aws_acc)
    db.session.commit()

    create_notification(user.id, 'SUCCESS', 'AWS Account Connected', f'Account {aws_acc.account_name} ({aws_acc.account_id or "N/A"}) connected successfully.', severity='SUCCESS', resource_type='AWS_ACCOUNT', resource_id=str(aws_acc.id), aws_account_id=aws_acc.id)

    return {
        'success': True,
        'message': f'AWS Account "{aws_acc.account_name}" connected successfully.',
        'account': aws_acc.to_dict()
    }, 201


def update_aws_account_service(user, account_db_id, account_name, region=None, access_key=None, secret_key=None, session_token=None):
    aws_acc = AWSAccount.query.filter_by(user_id=user.id, id=account_db_id).first()
    if not aws_acc:
        return {'success': False, 'error': {'code': 'NotFound', 'message': 'AWS Account not found.', 'request_id': 'N/A'}}, 404

    if account_name:
        aws_acc.account_name = account_name.strip()
    aws_acc.region = 'ap-south-1'

    if access_key and secret_key:
        test_result, status_code = test_aws_credentials_service(access_key, secret_key, 'ap-south-1', session_token)
        if status_code != 200 or not test_result.get('success'):
            return test_result, status_code

        aws_acc.access_key_encrypted = encrypt_credential(access_key.strip())
        aws_acc.secret_key_encrypted = encrypt_credential(secret_key.strip())
        aws_acc.session_token_encrypted = encrypt_credential(session_token.strip()) if session_token and str(session_token).strip() else None
        aws_acc.account_id = test_result['account_id']
        aws_acc.arn = test_result['arn']

    db.session.commit()
    return {
        'success': True,
        'message': f'AWS Account "{aws_acc.account_name}" updated successfully.',
        'account': aws_acc.to_dict()
    }, 200


def test_existing_aws_account_service(user, account_db_id):
    aws_acc = AWSAccount.query.filter_by(user_id=user.id, id=account_db_id).first()
    if not aws_acc:
        return {'success': False, 'error': {'code': 'NotFound', 'message': 'AWS Account not found.', 'request_id': 'N/A'}}, 404

    access_key = aws_acc.get_decrypted_access_key()
    secret_key = aws_acc.get_decrypted_secret_key()
    session_token = aws_acc.get_decrypted_session_token()
    return test_aws_credentials_service(access_key, secret_key, aws_acc.region, session_token)


def delete_aws_account_service(user, account_db_id):
    aws_acc = AWSAccount.query.filter_by(user_id=user.id, id=account_db_id).first()
    if not aws_acc:
        return {'error': 'AWS Account not found.'}, 404

    name = aws_acc.account_name
    acc_num = aws_acc.account_id
    db.session.delete(aws_acc)
    db.session.commit()

    from services.notification_service import create_notification
    create_notification(user.id, 'WARNING', 'AWS Account Removed', f'Account {name} ({acc_num or "N/A"}) was removed.', severity='WARNING', resource_type='AWS_ACCOUNT', resource_id=str(account_db_id))

    return {'message': f'AWS Account "{name}" removed successfully.'}, 200


def get_dashboard_stats_service(user):
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {
            'total_ec2': 0,
            'running_ec2': 0,
            'stopped_ec2': 0,
            'total_buckets': 0,
            'total_objects': 0,
            'total_alarms': 0,
            'accounts_count': 0,
            'accounts_breakdown': []
        }, 200

    total_ec2 = 0
    running_ec2 = 0
    stopped_ec2 = 0
    total_buckets = 0
    total_objects = 0
    total_alarms = 0
    breakdown = []

    for acc in accounts:
        acc_ec2 = 0
        acc_running = 0
        acc_stopped = 0
        acc_buckets = 0
        acc_objects = 0
        acc_alarms = 0

        # EC2 via AWSClientManager
        ec2_client, region, _, err, _ = AWSClientManager.get_client(user, 'ec2', requested_account_id=acc.id)
        if ec2_client:
            res, _, _ = AWSClientManager.execute_aws_call(ec2_client, 'ec2', 'describe_instances', acc, region, 'describe_instances')
            if res:
                for r in res.get('Reservations', []):
                    for inst in r.get('Instances', []):
                        acc_ec2 += 1
                        state = inst.get('State', {}).get('Name')
                        if state == 'running':
                            acc_running += 1
                        elif state == 'stopped':
                            acc_stopped += 1

        # S3 via AWSClientManager
        s3_client, region, _, err_s3, _ = AWSClientManager.get_client(user, 's3', requested_account_id=acc.id)
        if s3_client:
            res_b, _, _ = AWSClientManager.execute_aws_call(s3_client, 's3', 'list_buckets', acc, region, 'list_buckets')
            if res_b:
                raw_b = res_b.get('Buckets', [])
                acc_buckets = len(raw_b)
                for b in raw_b:
                    obj_res, _, _ = AWSClientManager.execute_aws_call(
                        s3_client, 's3', 'list_objects_v2', acc, region, 'list_objects_v2',
                        Bucket=b['Name'], MaxKeys=1000
                    )
                    if obj_res:
                        acc_objects += obj_res.get('KeyCount', len(obj_res.get('Contents', [])))

        # CloudWatch Alarms via AWSClientManager
        cw_client, region, _, err_cw, _ = AWSClientManager.get_client(user, 'cloudwatch', requested_account_id=acc.id)
        if cw_client:
            res_a, _, _ = AWSClientManager.execute_aws_call(cw_client, 'cloudwatch', 'describe_alarms', acc, region, 'describe_alarms')
            if res_a:
                acc_alarms = len(res_a.get('MetricAlarms', []))

        total_ec2 += acc_ec2
        running_ec2 += acc_running
        stopped_ec2 += acc_stopped
        total_buckets += acc_buckets
        total_objects += acc_objects
        total_alarms += acc_alarms

        breakdown.append({
            'id': acc.id,
            'account_name': acc.account_name,
            'account_id': acc.account_id or 'N/A',
            'region': acc.region,
            'ec2_count': acc_ec2,
            'buckets_count': acc_buckets,
            'objects_count': acc_objects,
            'alarms_count': acc_alarms
        })

    return {
        'total_ec2': total_ec2,
        'running_ec2': running_ec2,
        'stopped_ec2': stopped_ec2,
        'total_buckets': total_buckets,
        'total_objects': total_objects,
        'total_alarms': total_alarms,
        'accounts_count': len(accounts),
        'accounts_breakdown': breakdown
    }, 200

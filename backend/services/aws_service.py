import logging
import traceback
import boto3
from flask import request
from botocore.exceptions import BotoCoreError, ClientError, EndpointConnectionError, ParamValidationError, UnknownEndpointError
from models.user import db
from models.aws_account import AWSAccount
from utils.encryption import encrypt_credential

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

VALID_REGIONS = ['us-east-1', 'us-west-2', 'ap-south-1', 'ap-southeast-1', 'eu-central-1']


def get_target_aws_accounts(user, requested_account_id=None):
    """
    Returns a list of AWSAccount instances for the user based on requested_account_id or X-AWS-Account-ID header.
    - If requested_account_id == 'all': returns all accounts.
    - If requested_account_id is a specific ID integer: returns [account].
    - Defaults to header 'X-AWS-Account-ID' if set, otherwise returns all connected accounts.
    """
    if not user:
        return []

    target_id = requested_account_id
    if target_id is None:
        target_id = request.headers.get('X-AWS-Account-ID') or request.args.get('account_id')

    all_user_accounts = AWSAccount.query.filter_by(user_id=user.id).all()
    if not all_user_accounts:
        return []

    if target_id == 'all' or not target_id:
        return all_user_accounts

    try:
        acc_id_int = int(target_id)
        matched = [a for a in all_user_accounts if a.id == acc_id_int]
        return matched if matched else all_user_accounts
    except ValueError:
        return all_user_accounts


def test_aws_credentials_service(access_key, secret_key, region):
    if not access_key or not secret_key or not region:
        return {'error': 'Access Key, Secret Key, and Region are required.'}, 400

    clean_access = access_key.strip()
    clean_secret = secret_key.strip()
    clean_region = region.strip()

    try:
        sts_client = boto3.client(
            'sts',
            aws_access_key_id=clean_access,
            aws_secret_access_key=clean_secret,
            region_name=clean_region
        )
        
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
        error_code = e.response.get('Error', {}).get('Code', 'ClientError')
        error_msg = e.response.get('Error', {}).get('Message', str(e))
        return {
            'error': f'AWS STS Auth Error ({error_code}): {error_msg}',
            'code': error_code
        }, 400
    except Exception as e:
        return {'error': f'AWS Verification Failed: {str(e)}'}, 500


def list_aws_accounts_service(user):
    accounts = AWSAccount.query.filter_by(user_id=user.id).all()
    return {
        'count': len(accounts),
        'accounts': [a.to_dict() for a in accounts]
    }, 200


def add_aws_account_service(user, account_name, access_key, secret_key, region):
    if not account_name or not account_name.strip():
        account_name = 'AWS Account'

    test_result, status_code = test_aws_credentials_service(access_key, secret_key, region)
    if status_code != 200 or not test_result.get('success'):
        return test_result, status_code

    encrypted_access = encrypt_credential(access_key.strip())
    encrypted_secret = encrypt_credential(secret_key.strip())

    aws_acc = AWSAccount(
        user_id=user.id,
        account_name=account_name.strip(),
        access_key_encrypted=encrypted_access,
        secret_key_encrypted=encrypted_secret,
        region=region.strip(),
        account_id=test_result['account_id'],
        arn=test_result['arn']
    )
    db.session.add(aws_acc)
    db.session.commit()

    return {
        'message': f'AWS Account "{aws_acc.account_name}" connected successfully.',
        'account': aws_acc.to_dict()
    }, 201


def update_aws_account_service(user, account_db_id, account_name, region, access_key=None, secret_key=None):
    aws_acc = AWSAccount.query.filter_by(user_id=user.id, id=account_db_id).first()
    if not aws_acc:
        return {'error': 'AWS Account not found.'}, 404

    if account_name:
        aws_acc.account_name = account_name.strip()
    if region:
        aws_acc.region = region.strip()

    if access_key and secret_key:
        test_result, status_code = test_aws_credentials_service(access_key, secret_key, aws_acc.region)
        if status_code != 200 or not test_result.get('success'):
            return test_result, status_code

        aws_acc.access_key_encrypted = encrypt_credential(access_key.strip())
        aws_acc.secret_key_encrypted = encrypt_credential(secret_key.strip())
        aws_acc.account_id = test_result['account_id']
        aws_acc.arn = test_result['arn']

    db.session.commit()
    return {
        'message': f'AWS Account "{aws_acc.account_name}" updated successfully.',
        'account': aws_acc.to_dict()
    }, 200


def test_existing_aws_account_service(user, account_db_id):
    aws_acc = AWSAccount.query.filter_by(user_id=user.id, id=account_db_id).first()
    if not aws_acc:
        return {'error': 'AWS Account not found.'}, 404

    access_key = aws_acc.get_decrypted_access_key()
    secret_key = aws_acc.get_decrypted_secret_key()
    return test_aws_credentials_service(access_key, secret_key, aws_acc.region)


def delete_aws_account_service(user, account_db_id):
    aws_acc = AWSAccount.query.filter_by(user_id=user.id, id=account_db_id).first()
    if not aws_acc:
        return {'error': 'AWS Account not found.'}, 404

    name = aws_acc.account_name
    db.session.delete(aws_acc)
    db.session.commit()

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

        # EC2
        try:
            ec2_client = boto3.client(
                'ec2',
                aws_access_key_id=acc.get_decrypted_access_key(),
                aws_secret_access_key=acc.get_decrypted_secret_key(),
                region_name=acc.region or 'us-east-1'
            )
            res = ec2_client.describe_instances()
            for r in res.get('Reservations', []):
                for inst in r.get('Instances', []):
                    acc_ec2 += 1
                    state = inst.get('State', {}).get('Name')
                    if state == 'running':
                        acc_running += 1
                    elif state == 'stopped':
                        acc_stopped += 1
        except Exception:
            pass

        # S3
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=acc.get_decrypted_access_key(),
                aws_secret_access_key=acc.get_decrypted_secret_key(),
                region_name=acc.region or 'us-east-1'
            )
            res_b = s3_client.list_buckets()
            raw_b = res_b.get('Buckets', [])
            acc_buckets = len(raw_b)
            for b in raw_b:
                try:
                    obj_res = s3_client.list_objects_v2(Bucket=b['Name'], MaxKeys=1000)
                    acc_objects += obj_res.get('KeyCount', len(obj_res.get('Contents', [])))
                except Exception:
                    pass
        except Exception:
            pass

        # CloudWatch Alarms
        try:
            cw_client = boto3.client(
                'cloudwatch',
                aws_access_key_id=acc.get_decrypted_access_key(),
                aws_secret_access_key=acc.get_decrypted_secret_key(),
                region_name=acc.region or 'us-east-1'
            )
            res_a = cw_client.describe_alarms()
            acc_alarms = len(res_a.get('MetricAlarms', []))
        except Exception:
            pass

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

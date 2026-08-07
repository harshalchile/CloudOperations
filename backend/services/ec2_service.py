import boto3
from botocore.exceptions import BotoCoreError, ClientError
from models.aws_account import AWSAccount
from services.aws_service import get_target_aws_accounts
from utils.aws_audit import log_aws_call, extract_client_error, verify_sts_identity

INSTANCE_SIZE_MAP = {
    'Small (Free Tier)': 't2.micro',
    'Small': 't2.micro',
    'Medium': 't3.medium',
    'Large': 'c5.xlarge',
    't2.micro': 't2.micro',
    't3.medium': 't3.medium',
    'c5.xlarge': 'c5.xlarge',
}

def get_ec2_client_for_account(acc, req_region=None):
    """Instantiates an EC2 client after verifying STS caller identity."""
    identity, sts_err, status_code = verify_sts_identity(acc)
    if sts_err:
        return None, acc.region, sts_err, status_code

    region = req_region or acc.region or 'us-east-1'
    try:
        client = boto3.client(
            'ec2',
            aws_access_key_id=acc.get_decrypted_access_key(),
            aws_secret_access_key=acc.get_decrypted_secret_key(),
            region_name=region
        )
        return client, region, None, 200
    except ClientError as e:
        err_dict, sc = extract_client_error(e, "EC2 Client Creation Failed")
        return None, region, err_dict, sc
    except Exception as e:
        return None, region, {'error': f'Failed to create EC2 client: {str(e)}'}, 400


def resolve_ami_id(ec2_client, ssm_client, os_type, region):
    """
    Dynamically resolves a valid AMI ID for the target region using AWS SSM parameters or describe_images.
    Prevents InvalidAMIID.NotFound errors caused by hardcoded stale AMI IDs.
    """
    ssm_path_map = {
        'Amazon Linux': '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64',
        'Ubuntu': '/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id',
        'Windows Server': '/aws/service/ami-windows-latest/Windows_Server-2022-English-Full-Base',
        'Red Hat Enterprise': '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64'
    }

    param_path = ssm_path_map.get(os_type, ssm_path_map['Amazon Linux'])

    try:
        log_aws_call('ssm', 'get_parameter', {'Name': param_path, 'region': region})
        param_res = ssm_client.get_parameter(Name=param_path)
        ami_id = param_res.get('Parameter', {}).get('Value')
        if ami_id and ami_id.startswith('ami-'):
            return ami_id
    except Exception as e:
        print(f"[AMI RESOLVE WARNING] SSM parameter query failed for {os_type} in {region}: {e}")

    # Fallback: Describe latest Amazon Linux / Ubuntu image via EC2 client
    try:
        owners = ['amazon']
        filter_name = 'al2023-ami-2023.*-x86_64'
        if os_type == 'Ubuntu':
            owners = ['099720109477'] # Canonical owner ID
            filter_name = 'ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*'
        elif os_type == 'Windows Server':
            owners = ['amazon']
            filter_name = 'Windows_Server-2022-English-Full-Base-*'

        log_aws_call('ec2', 'describe_images', {'Filter': filter_name, 'Owners': owners, 'region': region})
        img_res = ec2_client.describe_images(
            Owners=owners,
            Filters=[{'Name': 'name', 'Values': [filter_name]}, {'Name': 'state', 'Values': ['available']}]
        )
        images = img_res.get('Images', [])
        if images:
            sorted_imgs = sorted(images, key=lambda x: x.get('CreationDate', ''), reverse=True)
            return sorted_imgs[0].get('ImageId')
    except Exception as e:
        print(f"[AMI RESOLVE WARNING] DescribeImages fallback failed: {e}")

    # Ultimate fallback default per region
    fallback_map = {
        'us-east-1': 'ami-0c101f26f147344e6',
        'ap-south-1': 'ami-022d03f649d12a49d',
        'ap-southeast-1': 'ami-060e277c0d4dce753',
        'us-west-2': 'ami-03f514f5aa447d485'
    }
    return fallback_map.get(region, 'ami-0c101f26f147344e6')


def list_ec2_instances_service(user):
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'instances': [], 'count': 0, 'message': 'No AWS accounts connected.'}, 200

    all_instances = []
    errors = []

    for acc in accounts:
        client, region, err, status_code = get_ec2_client_for_account(acc)
        if err or not client:
            errors.append(f"Account '{acc.account_name}': {err.get('error') if isinstance(err, dict) else err}")
            continue

        try:
            log_aws_call('ec2', 'describe_instances', {'region': region}, {'account_name': acc.account_name, 'account_id': acc.account_id})
            response = client.describe_instances()
            for reservation in response.get('Reservations', []):
                for inst in reservation.get('Instances', []):
                    name = 'Unnamed Server'
                    for tag in inst.get('Tags', []):
                        if tag.get('Key') == 'Name':
                            name = tag.get('Value')
                            break

                    os_type = 'Linux / Other'
                    if inst.get('Platform') == 'windows':
                        os_type = 'Windows Server'
                    elif 'ubuntu' in str(inst.get('ImageId', '')).lower():
                        os_type = 'Ubuntu'
                    else:
                        os_type = 'Amazon Linux 2023'

                    all_instances.append({
                        'instance_id': inst.get('InstanceId'),
                        'name': name,
                        'os': os_type,
                        'instance_type': inst.get('InstanceType'),
                        'status': inst.get('State', {}).get('Name', 'unknown'),
                        'public_ip': inst.get('PublicIpAddress', 'N/A'),
                        'private_ip': inst.get('PrivateIpAddress', 'N/A'),
                        'key_name': inst.get('KeyName', 'N/A'),
                        'region': region,
                        'aws_account_id': acc.id,
                        'aws_account_name': acc.account_name,
                        'aws_account_number': acc.account_id or 'N/A',
                        'launch_time': inst.get('LaunchTime').strftime('%Y-%m-%d %H:%M') if inst.get('LaunchTime') else 'N/A'
                    })
        except ClientError as e:
            err_dict, _ = extract_client_error(e)
            errors.append(f"Account '{acc.account_name}': {err_dict.get('error')}")
        except Exception as e:
            errors.append(f"Account '{acc.account_name}': {str(e)}")

    return {'instances': all_instances, 'count': len(all_instances), 'errors': errors}, 200


def get_ec2_client_for_instance(user, instance_id):
    accounts = get_target_aws_accounts(user)
    for acc in accounts:
        client, region, err, status_code = get_ec2_client_for_account(acc)
        if err or not client:
            continue
        try:
            log_aws_call('ec2', 'describe_instances', {'InstanceIds': [instance_id], 'region': region})
            res = client.describe_instances(InstanceIds=[instance_id])
            if res.get('Reservations'):
                return client, region, acc, None
        except Exception:
            pass

    return None, None, None, {'error': f'Instance "{instance_id}" not found in user AWS accounts.'}


def start_instance_service(user, instance_id):
    if not instance_id:
        return {'error': 'instance_id is required.'}, 400

    client, region, acc, err = get_ec2_client_for_instance(user, instance_id)
    if err or not client:
        return err or {'error': 'Failed to resolve instance owner.'}, 400

    try:
        log_aws_call('ec2', 'start_instances', {'InstanceIds': [instance_id], 'region': region})
        res = client.start_instances(InstanceIds=[instance_id])
        return {'message': f'Start request initiated for {instance_id}.', 'result': res.get('StartingInstances', [])}, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e)
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to start instance: {str(e)}'}, 500


def stop_instance_service(user, instance_id):
    if not instance_id:
        return {'error': 'instance_id is required.'}, 400

    client, region, acc, err = get_ec2_client_for_instance(user, instance_id)
    if err or not client:
        return err or {'error': 'Failed to resolve instance owner.'}, 400

    try:
        log_aws_call('ec2', 'stop_instances', {'InstanceIds': [instance_id], 'region': region})
        res = client.stop_instances(InstanceIds=[instance_id])
        return {'message': f'Stop request initiated for {instance_id}.', 'result': res.get('StoppingInstances', [])}, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e)
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to stop instance: {str(e)}'}, 500


def reboot_instance_service(user, instance_id):
    if not instance_id:
        return {'error': 'instance_id is required.'}, 400

    client, region, acc, err = get_ec2_client_for_instance(user, instance_id)
    if err or not client:
        return err or {'error': 'Failed to resolve instance owner.'}, 400

    try:
        log_aws_call('ec2', 'reboot_instances', {'InstanceIds': [instance_id], 'region': region})
        client.reboot_instances(InstanceIds=[instance_id])
        return {'message': f'Reboot request sent for {instance_id}.'}, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e)
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to reboot instance: {str(e)}'}, 500


def terminate_instance_service(user, instance_id):
    if not instance_id:
        return {'error': 'instance_id is required.'}, 400

    client, region, acc, err = get_ec2_client_for_instance(user, instance_id)
    if err or not client:
        return err or {'error': 'Failed to resolve instance owner.'}, 400

    try:
        log_aws_call('ec2', 'terminate_instances', {'InstanceIds': [instance_id], 'region': region})
        res = client.terminate_instances(InstanceIds=[instance_id])
        return {'message': f'Termination initiated for {instance_id}.', 'result': res.get('TerminatingInstances', [])}, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e)
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to terminate instance: {str(e)}'}, 500


def create_instance_service(user, name, os_type, instance_size, storage_gb, req_region):
    """
    Launches an EC2 instance with dynamic AMI resolution, parameter logging,
    and exact AWS ClientError exception reporting.
    """
    if not name or not name.strip():
        return {'error': 'Server Name is required.'}, 400

    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'error': 'No AWS accounts connected.'}, 400

    target_acc = accounts[0]
    target_region = req_region or target_acc.region or 'us-east-1'

    client, region, err, status_code = get_ec2_client_for_account(target_acc, req_region=target_region)
    if err or not client:
        return err or {'error': 'Failed to create EC2 client.'}, status_code

    ssm_client = boto3.client(
        'ssm',
        aws_access_key_id=target_acc.get_decrypted_access_key(),
        aws_secret_access_key=target_acc.get_decrypted_secret_key(),
        region_name=target_region
    )

    # 1. Resolve AMI ID dynamically
    ami_id = resolve_ami_id(client, ssm_client, os_type, target_region)
    instance_type = INSTANCE_SIZE_MAP.get(instance_size, 't2.micro')

    try:
        gb_size = int(storage_gb) if storage_gb else 8
    except ValueError:
        gb_size = 8

    # 2. Log Request Parameters
    params_log = {
        'ServerName': name.strip(),
        'OSType': os_type,
        'AMI_ID': ami_id,
        'InstanceType': instance_type,
        'StorageGB': gb_size,
        'Region': target_region,
        'Account': target_acc.account_name
    }
    log_aws_call('ec2', 'run_instances', params_log, {'account_name': target_acc.account_name, 'account_id': target_acc.account_id})

    # 3. Execute RunInstances with proper error handling
    run_kwargs = {
        'ImageId': ami_id,
        'InstanceType': instance_type,
        'MinCount': 1,
        'MaxCount': 1,
        'TagSpecifications': [
            {
                'ResourceType': 'instance',
                'Tags': [
                    {'Key': 'Name', 'Value': name.strip()},
                    {'Key': 'CreatedBy', 'Value': 'CloudOps-Platform'}
                ]
            }
        ]
    }

    try:
        run_res = client.run_instances(**run_kwargs)
        new_instance = run_res['Instances'][0]
        instance_id = new_instance.get('InstanceId')

        logger.info(f"<== EC2 INSTANCE LAUNCHED SUCCESSFULLY: InstanceId={instance_id}, Region={target_region}")

        return {
            'message': f'Server "{name}" launched successfully in AWS account "{target_acc.account_name}"!',
            'instance_id': instance_id,
            'status': new_instance.get('State', {}).get('Name', 'pending'),
            'instance_type': instance_type,
            'region': target_region,
            'ami_id': ami_id
        }, 201

    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "EC2 RunInstances Failed")
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to launch EC2 server: {str(e)}'}, 500

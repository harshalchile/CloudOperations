import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import boto3
from botocore.exceptions import ClientError
from services.aws_service import get_target_aws_accounts
from utils.aws_client_manager import AWSClientManager

logger = logging.getLogger("ec2_service")

INSTANCE_SIZE_MAP = {
    'Small (Free Tier)': 't2.micro',
    'Small': 't2.micro',
    'Medium': 't3.medium',
    'Large': 'c5.xlarge',
    't2.micro': 't2.micro',
    't3.medium': 't3.medium',
    'c5.xlarge': 'c5.xlarge',
}

DEFAULT_REGION = 'ap-south-1'


def resolve_ami_id(user, ssm_client, ec2_client, os_type, region, acc):
    """
    Dynamically resolves a valid AMI ID for ap-south-1 using AWS SSM parameters or describe_images via AWSClientManager.
    Prevents InvalidAMIID.NotFound errors caused by hardcoded stale AMI IDs.
    Defaults to Ubuntu 22.04 LTS.
    """
    target_region = DEFAULT_REGION

    normalized_os = 'Ubuntu'
    if os_type and 'amazon' in os_type.lower():
        normalized_os = 'Amazon Linux'
    elif os_type and 'ubuntu' in os_type.lower():
        normalized_os = 'Ubuntu'

    ssm_path_map = {
        'Ubuntu': '/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id',
        'Amazon Linux': '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64'
    }

    param_path = ssm_path_map.get(normalized_os, ssm_path_map['Ubuntu'])

    if ssm_client:
        param_res, _, _ = AWSClientManager.execute_aws_call(
            ssm_client, 'ssm', 'get_parameter', acc, target_region, 'get_parameter',
            Name=param_path
        )
        if param_res:
            ami_id = param_res.get('Parameter', {}).get('Value')
            if ami_id and ami_id.startswith('ami-'):
                return ami_id

    # Fallback: Describe images via EC2 client in ap-south-1
    if ec2_client:
        if normalized_os == 'Ubuntu':
            owners = ['099720109477']
            filter_name = 'ubuntu/images/hvm-ssd/ubuntu*22.04-amd64-server-*'
        else:
            owners = ['amazon']
            filter_name = 'al2023-ami-2023.*-x86_64'

        img_res, _, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'describe_images', acc, target_region, 'describe_images',
            Owners=owners,
            Filters=[{'Name': 'name', 'Values': [filter_name]}, {'Name': 'state', 'Values': ['available']}]
        )
        if img_res:
            images = img_res.get('Images', [])
            if images:
                sorted_imgs = sorted(images, key=lambda x: x.get('CreationDate', ''), reverse=True)
                return sorted_imgs[0].get('ImageId')

    # Verified fallback AMIs for ap-south-1
    fallback_map = {
        'Ubuntu': 'ami-03f514f5aa447d485',
        'Amazon Linux': 'ami-022d03f649d12a49d'
    }
    return fallback_map.get(normalized_os, 'ami-03f514f5aa447d485')


def list_key_pairs_service(user, req_region=None, requested_account_id=None):
    """Lists available AWS Key Pairs in ap-south-1."""
    ec2_client, region, target_acc, err, status_code = AWSClientManager.get_client(user, 'ec2', requested_account_id=requested_account_id, req_region=DEFAULT_REGION)
    if err or not ec2_client:
        return err, status_code

    res, err_call, sc = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'describe_key_pairs', target_acc, region, 'describe_key_pairs'
    )
    if err_call:
        return err_call, sc

    key_pairs = []
    for kp in res.get('KeyPairs', []):
        key_pairs.append({
            'key_name': kp.get('KeyName'),
            'key_pair_id': kp.get('KeyPairId'),
            'key_fingerprint': kp.get('KeyFingerprint'),
            'key_type': kp.get('KeyType', 'rsa'),
            'region': region
        })

    return {'key_pairs': key_pairs, 'count': len(key_pairs)}, 200


def create_key_pair_service(user, key_name, req_region=None, requested_account_id=None):
    """Creates a new 2048-bit RSA Key Pair on AWS and returns private key material."""
    if not key_name or not key_name.strip():
        return {'error': 'Key Pair Name is required.', 'code': 'InvalidParameterValue'}, 400

    clean_name = key_name.strip()
    ec2_client, region, target_acc, err, status_code = AWSClientManager.get_client(user, 'ec2', requested_account_id=requested_account_id, req_region=DEFAULT_REGION)
    if err or not ec2_client:
        return err, status_code

    res, err_call, sc = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'create_key_pair', target_acc, region, 'create_key_pair',
        KeyName=clean_name, KeyType='rsa'
    )
    if err_call:
        return err_call, sc

    return {
        'message': f'Key Pair "{clean_name}" created successfully.',
        'key_name': res.get('KeyName'),
        'key_fingerprint': res.get('KeyFingerprint'),
        'key_material': res.get('KeyMaterial'),
        'region': region
    }, 201


def ensure_ssh_security_group(user, ec2_client, target_acc, region):
    """
    Ensures a security group allowing SSH TCP 22 inbound traffic exists in ap-south-1.
    Creates 'cloudops-ssh-sg' if not found.
    Returns (sg_id, error_dict)
    """
    sg_name = 'cloudops-ssh-sg'
    res, err_call, _ = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'describe_security_groups', target_acc, region, 'describe_security_groups',
        Filters=[{'Name': 'group-name', 'Values': [sg_name]}]
    )

    if res and res.get('SecurityGroups'):
        sg = res['SecurityGroups'][0]
        sg_id = sg.get('GroupId')
        has_ssh_rule = any(
            perm.get('FromPort') == 22 or perm.get('ToPort') == 22
            for perm in sg.get('IpPermissions', [])
        )
        if not has_ssh_rule:
            AWSClientManager.execute_aws_call(
                ec2_client, 'ec2', 'authorize_security_group_ingress', target_acc, region, 'authorize_security_group_ingress',
                GroupId=sg_id,
                IpPermissions=[{
                    'IpProtocol': 'tcp',
                    'FromPort': 22,
                    'ToPort': 22,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
                }]
            )
        return sg_id, None

    create_res, err_create, sc = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'create_security_group', target_acc, region, 'create_security_group',
        GroupName=sg_name,
        Description='CloudOps SSH Access SG allowing TCP port 22'
    )
    if err_create:
        return None, err_create

    sg_id = create_res.get('GroupId')
    AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'authorize_security_group_ingress', target_acc, region, 'authorize_security_group_ingress',
        GroupId=sg_id,
        IpPermissions=[{
            'IpProtocol': 'tcp',
            'FromPort': 22,
            'ToPort': 22,
            'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
        }]
    )
    return sg_id, None


def ensure_rdp_security_group(user, ec2_client, target_acc, region):
    """
    Ensures a security group allowing RDP TCP 3389 inbound traffic exists in ap-south-1.
    Creates 'cloudops-rdp-sg' if not found.
    Returns (sg_id, error_dict)
    """
    sg_name = 'cloudops-rdp-sg'
    res, err_call, _ = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'describe_security_groups', target_acc, region, 'describe_security_groups',
        Filters=[{'Name': 'group-name', 'Values': [sg_name]}]
    )

    if res and res.get('SecurityGroups'):
        sg = res['SecurityGroups'][0]
        sg_id = sg.get('GroupId')
        has_rdp_rule = any(
            perm.get('FromPort') == 3389 or perm.get('ToPort') == 3389
            for perm in sg.get('IpPermissions', [])
        )
        if not has_rdp_rule:
            AWSClientManager.execute_aws_call(
                ec2_client, 'ec2', 'authorize_security_group_ingress', target_acc, region, 'authorize_security_group_ingress',
                GroupId=sg_id,
                IpPermissions=[{
                    'IpProtocol': 'tcp',
                    'FromPort': 3389,
                    'ToPort': 3389,
                    'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
                }]
            )
        return sg_id, None

    create_res, err_create, sc = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'create_security_group', target_acc, region, 'create_security_group',
        GroupName=sg_name,
        Description='CloudOps RDP Access SG allowing TCP port 3389'
    )
    if err_create:
        return None, err_create

    sg_id = create_res.get('GroupId')
    AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'authorize_security_group_ingress', target_acc, region, 'authorize_security_group_ingress',
        GroupId=sg_id,
        IpPermissions=[{
            'IpProtocol': 'tcp',
            'FromPort': 3389,
            'ToPort': 3389,
            'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
        }]
    )
    return sg_id, None


def ensure_default_subnet(user, ec2_client, target_acc, region):
    """
    Automatically discovers default VPC and picks a default subnet in ap-south-1.
    Prevents missing SubnetId launch errors.
    Returns (subnet_id, error_dict)
    """
    # 1. Describe default VPC
    res_vpc, err_vpc, _ = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'describe_vpcs', target_acc, region, 'describe_vpcs',
        Filters=[{'Name': 'isDefault', 'Values': ['true']}]
    )
    vpcs = res_vpc.get('Vpcs', []) if res_vpc else []
    if not vpcs:
        # Fallback to describing any available VPC
        res_vpc_all, _, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'describe_vpcs', target_acc, region, 'describe_vpcs'
        )
        vpcs = res_vpc_all.get('Vpcs', []) if res_vpc_all else []

    if not vpcs:
        return None, None  # Let AWS handle or fail if no VPCs exist

    vpc_id = vpcs[0].get('VpcId')

    # 2. Describe Subnets in the VPC
    res_sub, err_sub, _ = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'describe_subnets', target_acc, region, 'describe_subnets',
        Filters=[{'Name': 'vpc-id', 'Values': [vpc_id]}]
    )
    subnets = res_sub.get('Subnets', []) if res_sub else []
    if not subnets:
        return None, None

    # Prefer a subnet marked default-for-az or return the first available
    for s in subnets:
        if s.get('DefaultForAz'):
            return s.get('SubnetId'), None

    return subnets[0].get('SubnetId'), None


def fetch_ec2_instances_for_account(user, acc):
    ec2_client, region, target_acc, err, status_code = AWSClientManager.get_client(user, 'ec2', requested_account_id=acc.id, req_region=DEFAULT_REGION)
    if err or not ec2_client:
        err_msg = err.get('error') if isinstance(err, dict) else str(err)
        return [], f"Account '{acc.account_name}': {err_msg}"

    res, err_call, _ = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'describe_instances', target_acc, region, 'describe_instances'
    )

    if err_call:
        err_msg = err_call.get('error') if isinstance(err_call, dict) else str(err_call)
        return [], f"Account '{acc.account_name}': {err_msg}"

    raw_instances = []
    image_ids = set()
    for reservation in res.get('Reservations', []):
        for inst in reservation.get('Instances', []):
            raw_instances.append(inst)
            if inst.get('ImageId'):
                image_ids.add(inst.get('ImageId'))

    # Query AMI metadata in bulk
    images_meta = {}
    if image_ids and ec2_client:
        img_res, _, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'describe_images', target_acc, region, 'describe_images',
            ImageIds=list(image_ids)
        )
        if img_res and img_res.get('Images'):
            for img in img_res['Images']:
                images_meta[img['ImageId']] = img

    acc_instances = []
    for inst in raw_instances:
        name = 'Unnamed Server'
        for tag in inst.get('Tags', []):
            if tag.get('Key') == 'Name':
                name = tag.get('Value')
                break

        ami_id = inst.get('ImageId', 'N/A')
        img_obj = images_meta.get(ami_id, {})
        ami_name = img_obj.get('Name', 'N/A')
        ami_desc = img_obj.get('Description', '')
        architecture = inst.get('Architecture') or img_obj.get('Architecture', 'x86_64')
        platform_details = img_obj.get('PlatformDetails') or inst.get('PlatformDetails') or inst.get('Platform', 'Linux/UNIX')

        # Precise OS Identification
        os_type = 'Linux / Other'
        combined_text = f"{ami_id} {ami_name} {ami_desc} {platform_details}".lower()

        if inst.get('Platform') == 'windows' or 'windows' in str(platform_details).lower():
            os_type = 'Windows Server'
        elif 'ubuntu' in combined_text:
            os_type = 'Ubuntu'
        elif 'al2023' in combined_text or 'amzn' in combined_text or 'amazon linux' in combined_text:
            os_type = 'Amazon Linux'
        elif 'rhel' in combined_text or 'red hat' in combined_text:
            os_type = 'Red Hat Enterprise'
        else:
            os_type = 'Ubuntu' if 'canonical' in combined_text else 'Linux / Other'

        # Security Groups
        sgs = []
        for sg in inst.get('SecurityGroups', []):
            sgs.append({
                'group_id': sg.get('GroupId'),
                'group_name': sg.get('GroupName')
            })

        acc_instances.append({
            'id': inst.get('InstanceId'),
            'instance_id': inst.get('InstanceId'),
            'name': name,
            'instance_name': name,
            'os': os_type,
            'instance_type': inst.get('InstanceType'),
            'status': inst.get('State', {}).get('Name', 'unknown'),
            'state': inst.get('State', {}).get('Name', 'unknown'),
            'availability_zone': inst.get('Placement', {}).get('AvailabilityZone', 'N/A'),
            'public_ip': inst.get('PublicIpAddress', 'N/A'),
            'private_ip': inst.get('PrivateIpAddress', 'N/A'),
            'public_dns': inst.get('PublicDnsName', 'N/A'),
            'key_name': inst.get('KeyName', 'N/A'),
            'ami_id': ami_id,
            'ami_name': ami_name,
            'architecture': architecture,
            'platform': platform_details,
            'vpc_id': inst.get('VpcId', 'N/A'),
            'subnet_id': inst.get('SubnetId', 'N/A'),
            'security_groups': sgs,
            'region': region,
            'account_name': acc.account_name,
            'account_id': acc.account_id or 'N/A',
            'aws_account_id': acc.id,
            'aws_account_name': acc.account_name,
            'aws_account_number': acc.account_id or 'N/A',
            'launch_time': inst.get('LaunchTime').strftime('%Y-%m-%d %H:%M') if inst.get('LaunchTime') else 'N/A'
        })

    inst_ids = [i['instance_id'] for i in acc_instances]
    logger.info(f"[CLOUDWATCH] Loading EC2 instances")
    logger.info(f"[CLOUDWATCH] Selected AWS account: {acc.account_name}")
    logger.info(f"[CLOUDWATCH] AWS Account ID: {acc.account_id or 'N/A'}")
    logger.info(f"[CLOUDWATCH] Region: {region}")
    logger.info(f"[CLOUDWATCH] Calling STS GetCallerIdentity")
    logger.info(f"[CLOUDWATCH] Calling EC2 DescribeInstances")
    logger.info(f"[CLOUDWATCH] EC2 instances returned: {len(acc_instances)}")

    return acc_instances, None


def list_ec2_instances_service(user, requested_account_id=None):
    """Retrieves all EC2 instances concurrently across target user AWS accounts in ap-south-1."""
    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    if not accounts:
        return {'instances': [], 'count': 0, 'message': 'No connected AWS accounts found.'}, 200

    all_instances = []
    errors = []

    from flask import current_app
    app_obj = current_app._get_current_object()

    def fetch_with_context(acc_target):
        with app_obj.app_context():
            return fetch_ec2_instances_for_account(user, acc_target)

    with ThreadPoolExecutor(max_workers=min(len(accounts), 10)) as executor:
        future_to_acc = {executor.submit(fetch_with_context, acc): acc for acc in accounts}
        for future in as_completed(future_to_acc):
            acc = future_to_acc[future]
            try:
                acc_instances, err_msg = future.result()
                if err_msg:
                    errors.append(err_msg)
                all_instances.extend(acc_instances)
            except Exception as e:
                logger.error(f"[MULTI-ACCOUNT-EC2-ERROR] Account {acc.account_name}: {e}")
                errors.append(f"Account '{acc.account_name}': {str(e)}")

    return {'instances': all_instances, 'count': len(all_instances), 'errors': errors}, 200


def get_ec2_client_for_instance(user, instance_id, requested_account_id=None):
    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    for acc in accounts:
        ec2_client, region, target_acc, err, _ = AWSClientManager.get_client(user, 'ec2', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        if err or not ec2_client:
            continue
        res, _, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'describe_instances', target_acc, region, 'describe_instances',
            InstanceIds=[instance_id]
        )
        if res and res.get('Reservations'):
            return ec2_client, region, target_acc, None, 200

    return None, None, None, {'error': f'Instance "{instance_id}" not found in user AWS accounts.'}, 400


def start_instance_service(user, instance_id, requested_account_id=None):
    from services.notification_service import create_notification
    if not instance_id:
        return {'error': 'instance_id is required.'}, 400

    ec2_client, region, acc, err, status_code = get_ec2_client_for_instance(user, instance_id, requested_account_id=requested_account_id)
    if err or not ec2_client:
        err_text = err.get('error') if isinstance(err, dict) else str(err)
        create_notification(user.id, 'ERROR', 'EC2 Operation Failed', f'Unable to start instance {instance_id}: {err_text}', severity='ERROR', resource_type='EC2', resource_id=instance_id, aws_account_id=acc.id if acc else None)
        return err, status_code

    res, err_call, sc = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'start_instances', acc, region, 'start_instances',
        InstanceIds=[instance_id]
    )
    if err_call:
        err_msg = err_call.get('aws_error_message') or err_call.get('error')
        create_notification(user.id, 'ERROR', 'EC2 Operation Failed', f'Unable to start instance {instance_id}: {err_msg}', severity='ERROR', resource_type='EC2', resource_id=instance_id, aws_account_id=acc.id)
        return err_call, sc

    create_notification(user.id, 'SUCCESS', 'EC2 Instance Started', f'Instance {instance_id} started successfully in {acc.account_name}.', severity='SUCCESS', resource_type='EC2', resource_id=instance_id, aws_account_id=acc.id)
    return {'message': f'✅ EC2 Instance Started ({instance_id})', 'result': res.get('StartingInstances', [])}, 200


def stop_instance_service(user, instance_id, requested_account_id=None):
    from services.notification_service import create_notification
    if not instance_id:
        return {'error': 'instance_id is required.'}, 400

    ec2_client, region, acc, err, status_code = get_ec2_client_for_instance(user, instance_id, requested_account_id=requested_account_id)
    if err or not ec2_client:
        err_text = err.get('error') if isinstance(err, dict) else str(err)
        create_notification(user.id, 'ERROR', 'EC2 Operation Failed', f'Unable to stop instance {instance_id}: {err_text}', severity='ERROR', resource_type='EC2', resource_id=instance_id, aws_account_id=acc.id if acc else None)
        return err, status_code

    res, err_call, sc = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'stop_instances', acc, region, 'stop_instances',
        InstanceIds=[instance_id]
    )
    if err_call:
        err_msg = err_call.get('aws_error_message') or err_call.get('error')
        create_notification(user.id, 'ERROR', 'EC2 Operation Failed', f'Unable to stop instance {instance_id}: {err_msg}', severity='ERROR', resource_type='EC2', resource_id=instance_id, aws_account_id=acc.id)
        return err_call, sc

    create_notification(user.id, 'SUCCESS', 'EC2 Instance Stopped', f'Instance {instance_id} stopped successfully in {acc.account_name}.', severity='SUCCESS', resource_type='EC2', resource_id=instance_id, aws_account_id=acc.id)
    return {'message': f'✅ EC2 Instance Stopped ({instance_id})', 'result': res.get('StoppingInstances', [])}, 200


def reboot_instance_service(user, instance_id, requested_account_id=None):
    from services.notification_service import create_notification
    if not instance_id:
        return {'error': 'instance_id is required.'}, 400

    ec2_client, region, acc, err, status_code = get_ec2_client_for_instance(user, instance_id, requested_account_id=requested_account_id)
    if err or not ec2_client:
        err_text = err.get('error') if isinstance(err, dict) else str(err)
        create_notification(user.id, 'ERROR', 'EC2 Operation Failed', f'Unable to reboot instance {instance_id}: {err_text}', severity='ERROR', resource_type='EC2', resource_id=instance_id, aws_account_id=acc.id if acc else None)
        return err, status_code

    res, err_call, sc = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'reboot_instances', acc, region, 'reboot_instances',
        InstanceIds=[instance_id]
    )
    if err_call:
        err_msg = err_call.get('aws_error_message') or err_call.get('error')
        create_notification(user.id, 'ERROR', 'EC2 Operation Failed', f'Unable to reboot instance {instance_id}: {err_msg}', severity='ERROR', resource_type='EC2', resource_id=instance_id, aws_account_id=acc.id)
        return err_call, sc

    create_notification(user.id, 'SUCCESS', 'EC2 Instance Rebooted', f'Instance {instance_id} rebooted successfully in {acc.account_name}.', severity='SUCCESS', resource_type='EC2', resource_id=instance_id, aws_account_id=acc.id)
    return {'message': f'✅ EC2 Instance Rebooted ({instance_id})'}, 200


def terminate_instance_service(user, instance_id=None, instance_ids=None, requested_account_id=None):
    raw_ids = instance_ids or ([instance_id] if instance_id else [])
    if not raw_ids:
        return {'error': 'instance_id or instance_ids is required.'}, 400

    clean_ids = [i['instance_id'] if isinstance(i, dict) else str(i) for i in raw_ids if i]
    if not clean_ids:
        return {'error': 'No valid instance IDs provided.'}, 400

    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    if not accounts:
        return {'error': 'No connected AWS accounts found.'}, 400

    id_to_acc = {}
    for acc in accounts:
        ec2_client, region, target_acc, err, _ = AWSClientManager.get_client(user, 'ec2', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        if err or not ec2_client:
            continue
        try:
            res, _, _ = AWSClientManager.execute_aws_call(
                ec2_client, 'ec2', 'describe_instances', target_acc, region, 'describe_instances',
                InstanceIds=clean_ids
            )
            if res and res.get('Reservations'):
                for r in res['Reservations']:
                    for inst in r.get('Instances', []):
                        iid = inst.get('InstanceId')
                        id_to_acc[iid] = (acc, ec2_client, region)
        except Exception:
            pass

    acc_to_ids = {}
    for iid in clean_ids:
        if iid in id_to_acc:
            acc_obj, client, reg = id_to_acc[iid]
            acc_to_ids.setdefault(acc_obj.id, {'acc': acc_obj, 'client': client, 'region': reg, 'ids': []})['ids'].append(iid)
        else:
            logger.warning(f"Instance '{iid}' not found in connected AWS accounts during termination.")

    if not acc_to_ids:
        return {'error': f"Target instance(s) {clean_ids} not found in connected AWS accounts."}, 404

    terminated_results = []
    errors = []
    from services.notification_service import create_notification

    for acc_id, group in acc_to_ids.items():
        acc_obj = group['acc']
        client = group['client']
        reg = group['region']
        b_ids = group['ids']

        res, err_call, sc = AWSClientManager.execute_aws_call(
            client, 'ec2', 'terminate_instances', acc_obj, reg, 'terminate_instances',
            InstanceIds=b_ids
        )
        if res and res.get('TerminatingInstances'):
            for t_item in res['TerminatingInstances']:
                t_id = t_item.get('InstanceId')
                terminated_results.append({
                    'instance_id': t_id,
                    'current_state': t_item.get('CurrentState', {}).get('Name'),
                    'previous_state': t_item.get('PreviousState', {}).get('Name'),
                    'account_name': acc_obj.account_name
                })
                create_notification(
                    user_id=user.id,
                    notif_type='SUCCESS',
                    title='EC2 Instance Terminated',
                    message=f'Instance {t_id} was terminated in {acc_obj.account_name} ({acc_obj.account_id or "N/A"}).',
                    severity='SUCCESS',
                    resource_type='EC2',
                    resource_id=t_id,
                    aws_account_id=acc_obj.id
                )
        elif err_call:
            err_msg = err_call.get('aws_error_message') or err_call.get('error')
            errors.append(f"Account '{acc_obj.account_name}': {err_msg}")
            create_notification(
                user_id=user.id,
                notif_type='ERROR',
                title='EC2 Termination Failed',
                message=f'Failed to terminate instance(s) in {acc_obj.account_name}: {err_msg}',
                severity='ERROR',
                resource_type='EC2',
                aws_account_id=acc_obj.id
            )

    return {
        'message': f"Terminated {len(terminated_results)} instance(s).",
        'result': terminated_results,
        'errors': errors
    }, 200


def create_instance_service(user, name, os_type='Ubuntu', instance_size='Small (Free Tier)', storage_gb=20, req_region=None, key_name=None, requested_account_id=None):
    """
    Creates an EC2 instance in ap-south-1 adhering strictly to production specifications:
    - Pre-flight STS verification
    - SSM & DescribeImages dynamic AMI resolution for Ubuntu / Amazon Linux
    - Automatic SSH (22) Security Group attachment
    - Automatic Default VPC & Subnet resolution
    - BlockDeviceMappings with gp3 and DeleteOnTermination=True
    """
    start_time = time.time()

    if not name or not str(name).strip():
        return {'error': 'Server Name is required.', 'code': 'InvalidParameterValue'}, 400

    clean_name = str(name).strip()
    clean_os = 'Ubuntu' if not os_type or 'ubuntu' in str(os_type).lower() else os_type

    try:
        raw_storage = int(storage_gb)
    except (ValueError, TypeError):
        raw_storage = 20

    final_storage_gb = max(8, raw_storage)
    clean_key_name = str(key_name).strip() if key_name and str(key_name).strip() else None

    # 1. Initialize EC2 & SSM Boto3 Clients via AWSClientManager
    ec2_client, region, target_acc, err, status_code = AWSClientManager.get_client(
        user, 'ec2', requested_account_id=requested_account_id, req_region=DEFAULT_REGION
    )
    if err or not ec2_client:
        return err, status_code

    ssm_client, _, _, _, _ = AWSClientManager.get_client(
        user, 'ssm', requested_account_id=requested_account_id, req_region=DEFAULT_REGION
    )

    # 2. Resolve AMI ID dynamically
    ami_id = resolve_ami_id(user, ssm_client, ec2_client, clean_os, region, target_acc)
    instance_type = INSTANCE_SIZE_MAP.get(instance_size, 't2.micro')

    # 3. Detect Root Device Name from Image
    root_device_name = '/dev/sda1' if 'ubuntu' in clean_os.lower() else '/dev/xvda'
    if ec2_client:
        img_info, _, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'describe_images', target_acc, region, 'describe_images',
            ImageIds=[ami_id]
        )
        if img_info and img_info.get('Images'):
            root_device_name = img_info['Images'][0].get('RootDeviceName', root_device_name)

    # 4. Ensure SSH Security Group
    sg_id, sg_err = ensure_ssh_security_group(user, ec2_client, target_acc, region)
    if sg_err:
        return sg_err, 400

    # 5. Ensure Default Subnet
    subnet_id, sub_err = ensure_default_subnet(user, ec2_client, target_acc, region)

    if not ami_id or not str(ami_id).startswith('ami-'):
        return {'error': f'Failed to resolve a valid AMI ID for {clean_os} in {region}.', 'code': 'InvalidAMIID'}, 400

    if not instance_type:
        return {'error': f'Invalid Instance Type specification.', 'code': 'InvalidInstanceType'}, 400

    if not sg_id:
        return {'error': f'Failed to resolve Security Group for network access.', 'code': 'InvalidSecurityGroupID'}, 400

    if not subnet_id:
        return {'error': f'Failed to resolve SubnetId in VPC for region {region}.', 'code': 'InvalidSubnetID'}, 400

    # 6. Validate Key Pair if specified
    if clean_key_name:
        kp_res, kp_err, kp_sc = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'describe_key_pairs', target_acc, region, 'describe_key_pairs',
            KeyNames=[clean_key_name]
        )
        if kp_err:
            err_msg = kp_err.get('aws_error_message') or kp_err.get('error')
            from services.notification_service import create_notification
            create_notification(
                user_id=user.id,
                notif_type='ERROR',
                title='EC2 Launch Failed',
                message=f'Key Pair "{clean_key_name}" not found in {region}: {err_msg}',
                severity='ERROR',
                resource_type='EC2',
                aws_account_id=target_acc.id
            )
            return kp_err, kp_sc

    # 7. Build RunInstances parameters
    run_kwargs = {
        'ImageId': ami_id,
        'InstanceType': instance_type,
        'MinCount': 1,
        'MaxCount': 1,
        'SecurityGroupIds': [sg_id],
        'SubnetId': subnet_id,
        'BlockDeviceMappings': [
            {
                'DeviceName': root_device_name,
                'Ebs': {
                    'VolumeSize': final_storage_gb,
                    'VolumeType': 'gp3',
                    'DeleteOnTermination': True
                }
            }
        ],
        'TagSpecifications': [
            {
                'ResourceType': 'instance',
                'Tags': [
                    {'Key': 'Name', 'Value': clean_name},
                    {'Key': 'CreatedBy', 'Value': 'CloudOps-Platform'}
                ]
            }
        ]
    }

    if clean_key_name:
        run_kwargs['KeyName'] = clean_key_name

    logger.info(
        f"[EC2 LAUNCH]\n"
        f"Account ID: {target_acc.account_id}\n"
        f"Region: {region}\n"
        f"AMI: {ami_id}\n"
        f"Instance Type: {instance_type}\n"
        f"Key Pair: {clean_key_name or 'None'}\n"
        f"Subnet: {subnet_id}\n"
        f"Security Group: {sg_id}\n"
        f"Storage: {final_storage_gb} GB gp3"
    )

    # 8. Execute RunInstances call
    run_res, err_call, sc = AWSClientManager.execute_aws_call(
        ec2_client, 'ec2', 'run_instances', target_acc, region, 'run_instances',
        **run_kwargs
    )

    from services.notification_service import create_notification

    if err_call:
        err_msg = err_call.get('aws_error_message') or err_call.get('error')
        logger.error(
            f"[RUN-INSTANCES-FAILED] Account: {target_acc.account_name} ({target_acc.account_id}) | "
            f"Region: {region} | ErrorCode: {err_call.get('aws_error_code')} | Message: {err_msg}"
        )
        create_notification(
            user_id=user.id,
            notif_type='ERROR',
            title='EC2 Launch Failed',
            message=f'Unable to launch EC2 instance "{clean_name}": {err_msg}',
            severity='ERROR',
            resource_type='EC2',
            aws_account_id=target_acc.id
        )
        return err_call, sc

    new_instance = run_res['Instances'][0]
    instance_id = new_instance.get('InstanceId')
    initial_state = new_instance.get('State', {}).get('Name', 'pending')
    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    logger.info(
        f"[RUN-INSTANCES-SUCCESS] Account: {target_acc.account_name} ({target_acc.account_id}) | "
        f"InstanceID: {instance_id} | Region: {region} | ExecutionTime: {elapsed_ms}ms"
    )

    create_notification(
        user_id=user.id,
        notif_type='SUCCESS',
        title='EC2 Instance Created',
        message=f'Server: {clean_name} | Instance ID: {instance_id} | Account: {target_acc.account_name} | Region: {region} | Status: {initial_state.capitalize()}',
        severity='SUCCESS',
        resource_type='EC2',
        resource_id=instance_id,
        aws_account_id=target_acc.id
    )

    return {
        'success': True,
        'message': f'EC2 Instance Created. Server: {clean_name} | Instance ID: {instance_id} | Account: {target_acc.account_name} | Region: {region}',
        'instance': {
            'instance_id': instance_id,
            'name': clean_name,
            'state': initial_state,
            'account_id': target_acc.account_id,
            'region': region
        },
        'instance_id': instance_id,
        'status': initial_state,
        'instance_type': instance_type,
        'region': region,
        'ami_id': ami_id,
        'key_name': clean_key_name,
        'security_group': sg_id,
        'subnet_id': subnet_id,
        'storage_gb': final_storage_gb,
        'execution_time_ms': elapsed_ms
    }, 201

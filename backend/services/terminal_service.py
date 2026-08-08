import io
import time
import base64
import paramiko
import boto3
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization
from botocore.exceptions import ClientError
from services.aws_service import get_target_aws_accounts
from utils.aws_client_manager import AWSClientManager

DEFAULT_REGION = 'ap-south-1'

def generate_ephemeral_rsa_keypair():
    """Generates an in-memory 2048-bit RSA keypair for EC2 Instance Connect."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    public_ssh = key.public_key().public_bytes(
        encoding=serialization.Encoding.OpenSSH,
        format=serialization.PublicFormat.OpenSSH
    ).decode('utf-8')
    
    return private_pem, public_ssh


def send_ec2_instance_connect_key(user, instance_id, public_key_str, username='ec2-user', requested_account_id=None):
    """Sends SSH public key to EC2 instance via AWS EC2 Instance Connect API in ap-south-1."""
    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    if not accounts:
        raise ValueError("No AWS Account connected for current user.")

    last_err = None
    for acc in accounts:
        ec2_client, region, target_acc, err, _ = AWSClientManager.get_client(user, 'ec2', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        if err or not ec2_client:
            last_err = err.get('error') if isinstance(err, dict) else err
            continue

        res, err_call, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'describe_instances', target_acc, region, 'describe_instances',
            InstanceIds=[instance_id]
        )

        if err_call or not res:
            last_err = err_call.get('error') if err_call else 'Instance not found'
            continue

        reservations = res.get('Reservations', [])
        if not reservations or not reservations[0].get('Instances'):
            continue

        instance = reservations[0]['Instances'][0]
        az = instance.get('Placement', {}).get('AvailabilityZone')
        public_ip = instance.get('PublicIpAddress')
        state = instance.get('State', {}).get('Name')

        if state != 'running':
            raise ValueError(f"Instance {instance_id} is in state '{state}'. Server must be 'running' to establish SSH connection.")

        if not public_ip:
            raise ValueError(f"Instance {instance_id} does not have a public IP address.")

        eic_client, region_eic, target_acc_eic, err_eic, _ = AWSClientManager.get_client(user, 'ec2-instance-connect', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        if err_eic or not eic_client:
            raise ValueError(f"Failed to create EC2 Instance Connect client: {err_eic.get('error') if isinstance(err_eic, dict) else err_eic}")

        res_eic, err_eic_call, _ = AWSClientManager.execute_aws_call(
            eic_client, 'ec2-instance-connect', 'send_ssh_public_key', target_acc_eic, region_eic, 'send_ssh_public_key',
            InstanceId=instance_id, InstanceOSUser=username, SSHPublicKey=public_key_str, AvailabilityZone=az
        )

        if err_eic_call:
            raise ValueError(f"EC2 Instance Connect error: {err_eic_call.get('error')}")

        return public_ip, instance

    raise ValueError(f"Failed to send SSH key to instance {instance_id}: {str(last_err or 'Instance not found in connected AWS accounts.')}")


def connect_paramiko_ssh(host_ip, username, pem_key_str, cols=80, rows=24):
    """Establishes an interactive Paramiko SSH session."""
    ssh_client = paramiko.SSHClient()
    ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    key_file = io.StringIO(pem_key_str)
    pkey = None

    try:
        pkey = paramiko.RSAKey.from_private_key(key_file)
    except Exception:
        key_file.seek(0)
        try:
            pkey = paramiko.Ed25519Key.from_private_key(key_file)
        except Exception as err:
            raise ValueError(f"Failed to parse private key: {str(err)}")

    ssh_client.connect(
        hostname=host_ip,
        port=22,
        username=username,
        pkey=pkey,
        timeout=15,
        banner_timeout=15,
        allow_agent=False,
        look_for_keys=False
    )

    channel = ssh_client.invoke_shell(term='xterm', width=cols, height=rows)
    channel.settimeout(0.0)

    return ssh_client, channel


def get_windows_password_service(user, instance_id, pem_key_str=None, requested_account_id=None):
    """
    Calls boto3 ec2.get_password_data for a Windows instance using AWSClientManager in ap-south-1.
    If PasswordData is empty, returns message "Windows password is still being generated. Please wait."
    If pem_key_str is provided and PasswordData exists, decrypts using RSA PKCS1v15 padding.
    """
    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    if not accounts:
        return {'error': 'No AWS Account connected.'}, 400

    if not instance_id:
        return {'error': 'instance_id is required.'}, 400

    last_err = None
    for acc in accounts:
        ec2_client, region, target_acc, err, _ = AWSClientManager.get_client(user, 'ec2', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        if err or not ec2_client:
            last_err = err.get('error') if isinstance(err, dict) else err
            continue

        res, err_call, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'describe_instances', target_acc, region, 'describe_instances',
            InstanceIds=[instance_id]
        )
        if err_call or not res:
            last_err = err_call.get('error') if err_call else 'Instance not found'
            continue

        reservations = res.get('Reservations', [])
        if not reservations or not reservations[0].get('Instances'):
            continue

        inst = reservations[0]['Instances'][0]
        public_ip = inst.get('PublicIpAddress', 'N/A')
        private_ip = inst.get('PrivateIpAddress', 'N/A')
        public_dns = inst.get('PublicDnsName', 'N/A')
        state = inst.get('State', {}).get('Name', 'unknown')

        if state != 'running':
            return {
                'instance_id': instance_id,
                'public_ip': public_ip,
                'public_dns': public_dns,
                'username': 'Administrator',
                'has_password': False,
                'state': state,
                'message': 'Windows password is still being generated. Please wait.'
            }, 200

        pwd_res, pwd_err, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'get_password_data', target_acc, region, 'get_password_data',
            InstanceId=instance_id
        )
        if pwd_err:
            return pwd_err, 400

        password_data_b64 = pwd_res.get('PasswordData', '')

        if not password_data_b64:
            return {
                'instance_id': instance_id,
                'public_ip': public_ip,
                'public_dns': public_dns,
                'username': 'Administrator',
                'has_password': False,
                'state': state,
                'message': 'Windows password is still being generated. Please wait.'
            }, 200

        decrypted_password = None
        decryption_error = None

        if pem_key_str and pem_key_str.strip():
            try:
                encrypted_bytes = base64.b64decode(password_data_b64)
                pem_bytes = pem_key_str.strip().encode('utf-8')
                private_key = serialization.load_pem_private_key(pem_bytes, password=None)
                
                decrypted_bytes = private_key.decrypt(
                    encrypted_bytes,
                    padding.PKCS1v15()
                )
                decrypted_password = decrypted_bytes.decode('utf-8')
            except Exception as e:
                decryption_error = f"Failed to decrypt password using provided PEM key: {str(e)}"

        return {
            'instance_id': instance_id,
            'public_ip': public_ip,
            'public_dns': public_dns,
            'private_ip': private_ip,
            'username': 'Administrator',
            'has_password': True,
            'password_data_b64': password_data_b64,
            'decrypted_password': decrypted_password,
            'decryption_error': decryption_error,
            'aws_account_name': acc.account_name,
            'region': region
        }, 200

    return {'error': f'Failed to retrieve password for {instance_id}: {str(last_err or "Instance not found.")}'}, 400


def generate_rdp_file_service(user, instance_id, requested_account_id=None):
    """Generates a valid .rdp connection file content for a Windows EC2 instance using Public DNS or Public IP in ap-south-1."""
    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    if not accounts:
        return {'error': 'No AWS Account connected.'}, 400

    for acc in accounts:
        ec2_client, region, target_acc, err, _ = AWSClientManager.get_client(user, 'ec2', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        if err or not ec2_client:
            continue

        res, _, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'describe_instances', target_acc, region, 'describe_instances',
            InstanceIds=[instance_id]
        )
        if not res or not res.get('Reservations'):
            continue

        inst = res['Reservations'][0]['Instances'][0]
        public_ip = inst.get('PublicIpAddress')
        public_dns = inst.get('PublicDnsName')

        host_address = public_dns if (public_dns and public_dns != 'N/A') else public_ip

        if not host_address:
            return {'error': f'Instance {instance_id} does not have a public IP or Public DNS address.'}, 400

        rdp_content = f"""full address:s:{host_address}:3389
username:s:Administrator
prompt for credentials:i:1
administrative session:i:1
desktopwidth:i:1920
desktopheight:i:1080
session bpp:i:32
screen mode id:i:2
"""
        filename = f"ec2-{instance_id}.rdp"
        return {
            'filename': filename,
            'content': rdp_content,
            'public_ip': public_ip,
            'public_dns': public_dns,
            'host_address': host_address
        }, 200

    return {'error': f'Instance {instance_id} not found.'}, 404

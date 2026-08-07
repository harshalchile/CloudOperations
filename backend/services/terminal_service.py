import io
import time
import base64
import paramiko
import boto3
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization
from botocore.exceptions import ClientError
from services.aws_service import get_target_aws_accounts

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


def send_ec2_instance_connect_key(user, instance_id, public_key_str, username='ec2-user'):
    """Sends SSH public key to EC2 instance via AWS EC2 Instance Connect API."""
    accounts = get_target_aws_accounts(user)
    if not accounts:
        raise ValueError("No AWS Account connected for current user.")

    last_err = None
    for acc in accounts:
        access_key = acc.get_decrypted_access_key()
        secret_key = acc.get_decrypted_secret_key()
        region = acc.region or 'us-east-1'

        try:
            ec2_client = boto3.client('ec2', aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name=region)
            res = ec2_client.describe_instances(InstanceIds=[instance_id])

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

            eic_client = boto3.client('ec2-instance-connect', aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name=region)
            eic_client.send_ssh_public_key(
                InstanceId=instance_id,
                InstanceOSUser=username,
                SSHPublicKey=public_key_str,
                AvailabilityZone=az
            )

            return public_ip, instance
        except ClientError as e:
            last_err = e
            continue
        except Exception as e:
            last_err = e
            continue

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


def get_windows_password_service(user, instance_id, pem_key_str=None):
    """
    Calls boto3 ec2.get_password_data for a Windows instance.
    If pem_key_str is provided, decrypts the RSA encrypted PasswordData using PKCS1v15.
    """
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'error': 'No AWS Account connected.'}, 400

    if not instance_id:
        return {'error': 'instance_id is required.'}, 400

    last_err = None
    for acc in accounts:
        access_key = acc.get_decrypted_access_key()
        secret_key = acc.get_decrypted_secret_key()
        region = acc.region or 'us-east-1'

        try:
            ec2_client = boto3.client('ec2', aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name=region)
            res = ec2_client.describe_instances(InstanceIds=[instance_id])
            reservations = res.get('Reservations', [])
            if not reservations or not reservations[0].get('Instances'):
                continue

            inst = reservations[0]['Instances'][0]
            public_ip = inst.get('PublicIpAddress', 'N/A')
            private_ip = inst.get('PrivateIpAddress', 'N/A')

            # Fetch Password Data from AWS
            pwd_res = ec2_client.get_password_data(InstanceId=instance_id)
            password_data_b64 = pwd_res.get('PasswordData', '')

            if not password_data_b64:
                return {
                    'instance_id': instance_id,
                    'public_ip': public_ip,
                    'private_ip': private_ip,
                    'username': 'Administrator',
                    'has_password': False,
                    'message': 'Password is not available for this Windows instance. Password data is empty if the instance was launched without a Key Pair, or if the password was already retrieved/changed.'
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
                'private_ip': private_ip,
                'username': 'Administrator',
                'has_password': True,
                'password_data_b64': password_data_b64,
                'decrypted_password': decrypted_password,
                'decryption_error': decryption_error,
                'aws_account_name': acc.account_name,
                'region': region
            }, 200

        except ClientError as e:
            last_err = e.response.get('Error', {}).get('Message', str(e))
        except Exception as e:
            last_err = str(e)

    return {'error': f'Failed to retrieve password for {instance_id}: {str(last_err or "Instance not found.")}'}, 400


def generate_rdp_file_service(user, instance_id):
    """Generates an RDP connection file content for a Windows EC2 instance."""
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'error': 'No AWS Account connected.'}, 400

    for acc in accounts:
        try:
            ec2_client = boto3.client(
                'ec2',
                aws_access_key_id=acc.get_decrypted_access_key(),
                aws_secret_access_key=acc.get_decrypted_secret_key(),
                region_name=acc.region or 'us-east-1'
            )
            res = ec2_client.describe_instances(InstanceIds=[instance_id])
            reservations = res.get('Reservations', [])
            if not reservations or not reservations[0].get('Instances'):
                continue

            inst = reservations[0]['Instances'][0]
            public_ip = inst.get('PublicIpAddress')
            if not public_ip:
                return {'error': f'Instance {instance_id} does not have a public IP address.'}, 400

            rdp_content = f"""full address:s:{public_ip}:3389
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
                'public_ip': public_ip
            }, 200

        except Exception:
            continue

    return {'error': f'Instance {instance_id} not found.'}, 404

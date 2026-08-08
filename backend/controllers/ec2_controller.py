from flask import request, jsonify, Response
from services.ec2_service import (
    list_ec2_instances_service,
    start_instance_service,
    stop_instance_service,
    reboot_instance_service,
    terminate_instance_service,
    create_instance_service,
    list_key_pairs_service,
    create_key_pair_service
)
from services.terminal_service import (
    get_windows_password_service,
    generate_rdp_file_service
)

def list_ec2_controller(current_user):
    account_id = request.args.get('account_id') or request.args.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    response, status = list_ec2_instances_service(current_user, requested_account_id=account_id)
    return jsonify(response), status

def start_ec2_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId')
    account_id = data.get('account_id') or data.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    response, status = start_instance_service(current_user, instance_id, requested_account_id=account_id)
    return jsonify(response), status

def stop_ec2_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId')
    account_id = data.get('account_id') or data.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    response, status = stop_instance_service(current_user, instance_id, requested_account_id=account_id)
    return jsonify(response), status

def reboot_ec2_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId')
    account_id = data.get('account_id') or data.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    response, status = reboot_instance_service(current_user, instance_id, requested_account_id=account_id)
    return jsonify(response), status

def terminate_ec2_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId')
    instance_ids = data.get('instance_ids') or data.get('instanceIds')
    account_id = data.get('account_id') or data.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    response, status = terminate_instance_service(current_user, instance_id=instance_id, instance_ids=instance_ids, requested_account_id=account_id)
    return jsonify(response), status

def create_ec2_controller(current_user):
    data = request.get_json() or {}
    name = data.get('name')
    os_type = data.get('os_type') or data.get('osType') or 'Ubuntu'
    instance_size = data.get('instance_size') or data.get('instanceSize') or 'Small (Free Tier)'
    storage_gb = data.get('storage_gb') or data.get('storageGb') or 20
    region = data.get('region') or 'ap-south-1'
    key_name = data.get('key_name') or data.get('keyName')
    account_id = data.get('account_id') or data.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')

    response, status = create_instance_service(
        current_user, name, os_type, instance_size, storage_gb, region, key_name=key_name, requested_account_id=account_id
    )
    return jsonify(response), status

def list_key_pairs_controller(current_user):
    region = request.args.get('region') or 'ap-south-1'
    account_id = request.args.get('account_id') or request.args.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    response, status = list_key_pairs_service(current_user, req_region=region, requested_account_id=account_id)
    return jsonify(response), status

def create_key_pair_controller(current_user):
    data = request.get_json() or {}
    key_name = data.get('key_name') or data.get('keyName')
    region = data.get('region') or 'ap-south-1'
    account_id = data.get('account_id') or data.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    response, status = create_key_pair_service(current_user, key_name, req_region=region, requested_account_id=account_id)
    return jsonify(response), status

def get_windows_password_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId')
    pem_key = data.get('pem_key') or data.get('pemKey')
    account_id = data.get('account_id') or data.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    response, status = get_windows_password_service(current_user, instance_id, pem_key, requested_account_id=account_id)
    return jsonify(response), status

def download_rdp_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId') or request.args.get('instance_id')
    account_id = data.get('account_id') or data.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    response, status = generate_rdp_file_service(current_user, instance_id, requested_account_id=account_id)
    
    if status == 200 and 'content' in response:
        filename = response.get('filename', f'ec2-{instance_id}.rdp')
        return Response(
            response['content'],
            mimetype='application/x-rdp',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )
    return jsonify(response), status

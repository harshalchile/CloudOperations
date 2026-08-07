from flask import request, jsonify, Response
from services.ec2_service import (
    list_ec2_instances_service,
    start_instance_service,
    stop_instance_service,
    reboot_instance_service,
    terminate_instance_service,
    create_instance_service
)
from services.terminal_service import (
    get_windows_password_service,
    generate_rdp_file_service
)

def list_ec2_controller(current_user):
    response, status = list_ec2_instances_service(current_user)
    return jsonify(response), status

def start_ec2_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId')
    response, status = start_instance_service(current_user, instance_id)
    return jsonify(response), status

def stop_ec2_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId')
    response, status = stop_instance_service(current_user, instance_id)
    return jsonify(response), status

def reboot_ec2_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId')
    response, status = reboot_instance_service(current_user, instance_id)
    return jsonify(response), status

def terminate_ec2_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId')
    response, status = terminate_instance_service(current_user, instance_id)
    return jsonify(response), status

def create_ec2_controller(current_user):
    data = request.get_json() or {}
    name = data.get('name')
    os_type = data.get('os_type') or data.get('osType') or 'Amazon Linux'
    instance_size = data.get('instance_size') or data.get('instanceSize') or 'Small (Free Tier)'
    storage_gb = data.get('storage_gb') or data.get('storageGb') or 8
    region = data.get('region')

    response, status = create_instance_service(current_user, name, os_type, instance_size, storage_gb, region)
    return jsonify(response), status

def get_windows_password_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId')
    pem_key = data.get('pem_key') or data.get('pemKey')
    response, status = get_windows_password_service(current_user, instance_id, pem_key)
    return jsonify(response), status

def download_rdp_controller(current_user):
    data = request.get_json() or {}
    instance_id = data.get('instance_id') or data.get('instanceId') or request.args.get('instance_id')
    response, status = generate_rdp_file_service(current_user, instance_id)
    
    if status == 200 and 'content' in response:
        filename = response.get('filename', f'ec2-{instance_id}.rdp')
        return Response(
            response['content'],
            mimetype='application/x-rdp',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )
    return jsonify(response), status

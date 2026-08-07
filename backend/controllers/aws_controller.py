from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.user import User
from services.aws_service import (
    test_aws_credentials_service,
    list_aws_accounts_service,
    add_aws_account_service,
    update_aws_account_service,
    test_existing_aws_account_service,
    delete_aws_account_service,
    get_dashboard_stats_service
)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id)

@jwt_required()
def list_accounts_controller():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404
    data, code = list_aws_accounts_service(user)
    return jsonify(data), code

@jwt_required()
def add_account_controller():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    payload = request.get_json() or {}
    account_name = payload.get('account_name') or payload.get('accountName') or 'AWS Account'
    access_key = payload.get('access_key') or payload.get('accessKey')
    secret_key = payload.get('secret_key') or payload.get('secretKey')
    region = payload.get('region', 'us-east-1')

    data, code = add_aws_account_service(user, account_name, access_key, secret_key, region)
    return jsonify(data), code

@jwt_required()
def update_account_controller(account_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    payload = request.get_json() or {}
    account_name = payload.get('account_name') or payload.get('accountName')
    region = payload.get('region')
    access_key = payload.get('access_key') or payload.get('accessKey')
    secret_key = payload.get('secret_key') or payload.get('secretKey')

    data, code = update_aws_account_service(user, account_id, account_name, region, access_key, secret_key)
    return jsonify(data), code

@jwt_required()
def test_account_controller(account_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    data, code = test_existing_aws_account_service(user, account_id)
    return jsonify(data), code

@jwt_required()
def delete_account_controller(account_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    data, code = delete_aws_account_service(user, account_id)
    return jsonify(data), code

@jwt_required()
def get_dashboard_stats_controller():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    data, code = get_dashboard_stats_service(user)
    return jsonify(data), code

# Backwards compatibility handlers
@jwt_required()
def test_aws_controller(current_user=None):
    user = get_current_user()
    payload = request.get_json() or {}
    access_key = payload.get('accessKey') or payload.get('access_key')
    secret_key = payload.get('secretKey') or payload.get('secret_key')
    region = payload.get('region', 'us-east-1')

    response, status = test_aws_credentials_service(access_key, secret_key, region)
    return jsonify(response), status

@jwt_required()
def connect_aws_controller(current_user=None):
    user = get_current_user()
    payload = request.get_json() or {}
    account_name = payload.get('account_name') or payload.get('accountName') or 'Personal'
    access_key = payload.get('accessKey') or payload.get('access_key')
    secret_key = payload.get('secretKey') or payload.get('secret_key')
    region = payload.get('region', 'us-east-1')

    data, code = add_aws_account_service(user, account_name, access_key, secret_key, region)
    return jsonify(data), code

@jwt_required()
def get_aws_status_controller(current_user=None):
    user = get_current_user()
    data, code = list_aws_accounts_service(user)
    return jsonify(data), code

@jwt_required()
def get_diagnostics_controller():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404
    from utils.aws_audit import audit_iam_permissions_and_apis
    data, code = audit_iam_permissions_and_apis(user)
    return jsonify(data), code

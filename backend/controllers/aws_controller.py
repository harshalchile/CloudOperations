from flask import request, jsonify
from services.aws_service import (
    test_aws_credentials_service,
    list_aws_accounts_service,
    add_aws_account_service,
    update_aws_account_service,
    test_existing_aws_account_service,
    delete_aws_account_service,
    get_dashboard_stats_service
)

def list_accounts_controller(current_user):
    data, code = list_aws_accounts_service(current_user)
    return jsonify(data), code

def add_account_controller(current_user):
    payload = request.get_json() or {}
    account_name = payload.get('account_name') or payload.get('accountName') or 'AWS Account'
    access_key = payload.get('access_key') or payload.get('accessKey')
    secret_key = payload.get('secret_key') or payload.get('secretKey')
    session_token = payload.get('session_token') or payload.get('sessionToken')
    region = 'ap-south-1'

    data, code = add_aws_account_service(current_user, account_name, access_key, secret_key, region, session_token)
    return jsonify(data), code

def update_account_controller(current_user, account_id):
    payload = request.get_json() or {}
    account_name = payload.get('account_name') or payload.get('accountName')
    region = 'ap-south-1'
    access_key = payload.get('access_key') or payload.get('accessKey')
    secret_key = payload.get('secret_key') or payload.get('secretKey')
    session_token = payload.get('session_token') or payload.get('sessionToken')

    data, code = update_aws_account_service(current_user, account_id, account_name, region, access_key, secret_key, session_token)
    return jsonify(data), code

def test_account_controller(current_user, account_id):
    data, code = test_existing_aws_account_service(current_user, account_id)
    return jsonify(data), code

def delete_account_controller(current_user, account_id):
    data, code = delete_aws_account_service(current_user, account_id)
    return jsonify(data), code

def get_dashboard_stats_controller(current_user):
    data, code = get_dashboard_stats_service(current_user)
    return jsonify(data), code

# Backwards compatibility handlers
def test_aws_controller(current_user):
    payload = request.get_json() or {}
    access_key = payload.get('accessKey') or payload.get('access_key')
    secret_key = payload.get('secretKey') or payload.get('secret_key')
    session_token = payload.get('sessionToken') or payload.get('session_token')
    region = 'ap-south-1'

    response, status = test_aws_credentials_service(access_key, secret_key, region, session_token)
    return jsonify(response), status

def connect_aws_controller(current_user):
    payload = request.get_json() or {}
    account_name = payload.get('account_name') or payload.get('accountName') or 'Personal'
    access_key = payload.get('accessKey') or payload.get('access_key')
    secret_key = payload.get('secretKey') or payload.get('secret_key')
    session_token = payload.get('sessionToken') or payload.get('session_token')
    region = 'ap-south-1'

    data, code = add_aws_account_service(current_user, account_name, access_key, secret_key, region, session_token)
    return jsonify(data), code

def get_aws_status_controller(current_user):
    data, code = list_aws_accounts_service(current_user)
    return jsonify(data), code

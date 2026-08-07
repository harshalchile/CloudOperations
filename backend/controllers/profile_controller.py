from flask import request, jsonify
from services.auth_service import update_profile_service, change_password_service

def update_profile_controller(current_user):
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')

    response, status = update_profile_service(current_user, name, email)
    return jsonify(response), status

def change_password_controller(current_user):
    data = request.get_json() or {}
    current_password = data.get('currentPassword') or data.get('current_password')
    new_password = data.get('newPassword') or data.get('new_password')

    response, status = change_password_service(current_user, current_password, new_password)
    return jsonify(response), status

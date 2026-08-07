from flask import request, jsonify
from services.auth_service import register_user_service, login_user_service

def register_controller():
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirmPassword') or data.get('confirm_password')

    if confirm_password and password != confirm_password:
        return jsonify({'error': 'Passwords do not match.'}), 400

    response, status = register_user_service(name, email, password)
    return jsonify(response), status

def login_controller():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    response, status = login_user_service(email, password)
    return jsonify(response), status

def logout_controller(current_user):
    # JWT is stateless or revoked on client side; return success confirmation
    return jsonify({'message': 'Logged out successfully.'}), 200

def get_me_controller(current_user):
    user_data = current_user.to_dict()
    return jsonify({'user': user_data}), 200

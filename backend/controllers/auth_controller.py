from flask import request, jsonify
from flask_jwt_extended import create_access_token
from services.auth_service import (
    register_user_service,
    login_user_service,
    reset_password_service
)

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

def reset_password_controller():
    data = request.get_json() or {}
    email = data.get('email')
    master_key = data.get('master_key') or data.get('masterKey')
    new_password = data.get('new_password') or data.get('newPassword')
    confirm_password = data.get('confirm_password') or data.get('confirmPassword')

    if not new_password or not confirm_password:
        return jsonify({'error': 'New password and confirm password are required.'}), 400

    if new_password != confirm_password:
        return jsonify({'error': 'Passwords do not match.'}), 400

    response, status = reset_password_service(email, master_key, new_password)
    return jsonify(response), status

def logout_controller(current_user):
    from services.notification_service import create_notification
    if current_user:
        create_notification(
            user_id=current_user.id,
            notif_type='INFO',
            title='Signed Out',
            message='Signed out of CloudOps Enterprise.',
            severity='INFO',
            resource_type='AUTH'
        )
    return jsonify({'message': 'Logged out successfully.'}), 200

def get_me_controller(current_user):
    user_data = current_user.to_dict()
    return jsonify({'user': user_data}), 200

def refresh_token_controller(current_user):
    new_token = create_access_token(identity=str(current_user.id))
    return jsonify({
        'message': 'Token refreshed successfully.',
        'access_token': new_token,
        'expiration': 86400,
        'user': current_user.to_dict()
    }), 200

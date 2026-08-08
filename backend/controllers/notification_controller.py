from flask import request, jsonify
from services.notification_service import (
    get_notifications_service,
    get_unread_count_service,
    mark_notification_read_service,
    mark_all_notifications_read_service,
    delete_notification_service,
    delete_all_notifications_service
)

def list_notifications_controller(current_user):
    page = request.args.get('page', 1)
    limit = request.args.get('limit', 20)
    unread_only = request.args.get('unread_only', '').lower() in ('true', '1')
    resource_type = request.args.get('resource_type')
    account_id = request.args.get('account_id') or request.args.get('aws_account_id')
    notif_type = request.args.get('type')

    response, status = get_notifications_service(
        current_user,
        page=page,
        limit=limit,
        unread_only=unread_only,
        resource_type=resource_type,
        account_id=account_id,
        notif_type=notif_type
    )
    return jsonify(response), status

def get_unread_count_controller(current_user):
    response, status = get_unread_count_service(current_user)
    return jsonify(response), status

def mark_notification_read_controller(current_user, notification_id):
    response, status = mark_notification_read_service(current_user, notification_id)
    return jsonify(response), status

def mark_all_notifications_read_controller(current_user):
    response, status = mark_all_notifications_read_service(current_user)
    return jsonify(response), status

def delete_notification_controller(current_user, notification_id):
    response, status = delete_notification_service(current_user, notification_id)
    return jsonify(response), status

def delete_all_notifications_controller(current_user):
    response, status = delete_all_notifications_service(current_user)
    return jsonify(response), status

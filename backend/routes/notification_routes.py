from flask import Blueprint
from controllers.notification_controller import (
    list_notifications_controller,
    get_unread_count_controller,
    mark_notification_read_controller,
    mark_all_notifications_read_controller,
    delete_notification_controller,
    delete_all_notifications_controller
)
from middleware.jwt_auth import jwt_required_custom

notification_bp = Blueprint('notification', __name__, url_prefix='/api/notifications')

notification_bp.route('', methods=['GET'])(jwt_required_custom(list_notifications_controller))
notification_bp.route('/unread-count', methods=['GET'])(jwt_required_custom(get_unread_count_controller))
notification_bp.route('/<int:notification_id>/read', methods=['PATCH'])(jwt_required_custom(mark_notification_read_controller))
notification_bp.route('/read-all', methods=['PATCH'])(jwt_required_custom(mark_all_notifications_read_controller))
notification_bp.route('/<int:notification_id>', methods=['DELETE'])(jwt_required_custom(delete_notification_controller))
notification_bp.route('', methods=['DELETE'])(jwt_required_custom(delete_all_notifications_controller))

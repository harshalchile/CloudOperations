import logging
from models.user import db
from models.notification import Notification

logger = logging.getLogger("notification_service")

def create_notification(user_id, notif_type, title, message, severity=None, resource_type='AUTH', resource_id=None, aws_account_id=None):
    """
    Creates a database-backed Notification for user_id and emits real-time Socket.IO event.
    """
    if not user_id:
        return None

    clean_type = str(notif_type).upper() if notif_type else 'INFO'
    if clean_type not in ('SUCCESS', 'ERROR', 'INFO', 'WARNING'):
        clean_type = 'INFO'

    clean_severity = str(severity).upper() if severity else clean_type
    if clean_severity not in ('SUCCESS', 'ERROR', 'INFO', 'WARNING'):
        clean_severity = clean_type

    clean_res_type = str(resource_type).upper() if resource_type else 'AUTH'
    if clean_res_type not in ('EC2', 'S3', 'CLOUDWATCH', 'AWS_ACCOUNT', 'AUTH'):
        clean_res_type = 'AUTH'

    try:
        notification = Notification(
            user_id=user_id,
            aws_account_id=aws_account_id,
            type=clean_type,
            title=str(title).strip(),
            message=str(message).strip(),
            severity=clean_severity,
            resource_type=clean_res_type,
            resource_id=str(resource_id) if resource_id else None,
            is_read=False
        )
        db.session.add(notification)
        db.session.commit()

        dict_data = notification.to_dict()

        # Emit real-time WebSocket event
        try:
            from app import socketio
            socketio.emit('new_notification', dict_data, room=f"user_{user_id}")
            socketio.emit('new_notification', dict_data)
        except Exception as e:
            logger.warning(f"Failed to emit WebSocket notification event: {e}")

        logger.info(f"[NOTIFICATION-CREATED] User: {user_id} | Type: {clean_type} | Title: '{title}'")
        return dict_data
    except Exception as e:
        db.session.rollback()
        logger.error(f"[NOTIFICATION-ERROR] Failed to create notification: {e}")
        return None


def get_notifications_service(user, page=1, limit=20, unread_only=False, resource_type=None, account_id=None, notif_type=None):
    """
    Returns paginated notifications for the authenticated user.
    """
    query = Notification.query.filter_by(user_id=user.id)

    if unread_only:
        query = query.filter_by(is_read=False)

    if resource_type and str(resource_type).upper() != 'ALL':
        query = query.filter_by(resource_type=str(resource_type).upper())

    if notif_type and str(notif_type).upper() != 'ALL':
        query = query.filter_by(type=str(notif_type).upper())

    if account_id and str(account_id).lower() not in ('all', '', 'none'):
        try:
            query = query.filter_by(aws_account_id=int(account_id))
        except (ValueError, TypeError):
            pass

    query = query.order_by(Notification.created_at.desc())

    try:
        page_num = max(1, int(page))
        limit_num = min(100, max(1, int(limit)))
    except (ValueError, TypeError):
        page_num, limit_num = 1, 20

    pagination = query.paginate(page=page_num, per_page=limit_num, error_out=False)
    unread_count = Notification.query.filter_by(user_id=user.id, is_read=False).count()

    return {
        'notifications': [n.to_dict() for n in pagination.items],
        'total': pagination.total,
        'page': page_num,
        'limit': limit_num,
        'pages': pagination.pages,
        'unread_count': unread_count
    }, 200


def get_unread_count_service(user):
    """
    Returns total unread notification count for authenticated user.
    """
    count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return {'count': count}, 200


def mark_notification_read_service(user, notification_id):
    """
    Marks a single notification as read.
    """
    notif = Notification.query.filter_by(id=notification_id, user_id=user.id).first()
    if not notif:
        return {'error': 'Notification not found.'}, 404

    notif.is_read = True
    db.session.commit()
    unread_count = Notification.query.filter_by(user_id=user.id, is_read=False).count()

    return {'message': 'Notification marked as read.', 'notification': notif.to_dict(), 'unread_count': unread_count}, 200


def mark_all_notifications_read_service(user):
    """
    Marks all notifications for authenticated user as read.
    """
    Notification.query.filter_by(user_id=user.id, is_read=False).update({'is_read': True})
    db.session.commit()
    return {'message': 'All notifications marked as read.', 'unread_count': 0}, 200


def delete_notification_service(user, notification_id):
    """
    Deletes a single notification.
    """
    notif = Notification.query.filter_by(id=notification_id, user_id=user.id).first()
    if not notif:
        return {'error': 'Notification not found.'}, 404

    db.session.delete(notif)
    db.session.commit()
    unread_count = Notification.query.filter_by(user_id=user.id, is_read=False).count()

    return {'message': 'Notification deleted.', 'unread_count': unread_count}, 200


def delete_all_notifications_service(user):
    """
    Deletes all notifications for authenticated user.
    """
    Notification.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    return {'message': 'All notifications deleted.', 'unread_count': 0}, 200

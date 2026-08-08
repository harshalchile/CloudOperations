from functools import wraps
import logging
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from models.user import db, User

logger = logging.getLogger("jwt_auth")

def get_current_user():
    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        if not user_id:
            logger.warning("[JWT-AUTH] Missing JWT identity in request.")
            return None
        
        # User lookup in cloudops.db
        user = db.session.get(User, int(user_id)) if hasattr(db.session, 'get') else User.query.get(int(user_id))
        if not user:
            logger.warning(f"[JWT-AUTH] User not found for JWT identity ID: {user_id}")
            return None
        return user
    except Exception as e:
        logger.warning(f"[JWT-AUTH-ERROR] JWT verification failed: {e}")
        return None

def jwt_required_custom(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Unauthorized access. Token invalid or expired.', 'code': 'Unauthorized'}), 401
        return fn(user, *args, **kwargs)
    return wrapper

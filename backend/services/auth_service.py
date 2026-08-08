import re
import logging
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token
from models.user import db, User

bcrypt = Bcrypt()
logger = logging.getLogger("auth_service")

# Master Reset Key constant for Demo Mode (Never expose to frontend JavaScript)
MASTER_RESET_KEY = "HEXRESET2026"


def register_user_service(name, email, password):
    if not name or not email or not password:
        return {'error': 'Full Name, Email and Password are required.'}, 400

    email_clean = email.strip().lower()
    email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    if not re.match(email_regex, email_clean):
        return {'error': 'Invalid email address format.'}, 400

    if len(password) < 6:
        return {'error': 'Password must be at least 6 characters long.'}, 400

    # Case-insensitive user check
    existing_user = User.query.filter(db.func.lower(User.email) == email_clean).first()
    if existing_user:
        return {'error': 'Email address is already registered.'}, 409

    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(
        name=name.strip(),
        email=email_clean,
        password_hash=password_hash
    )

    db.session.add(new_user)
    db.session.commit()

    access_token = create_access_token(identity=str(new_user.id))
    logger.info(f"[AUTH-REGISTER] New user registered successfully: {email_clean} (ID: {new_user.id})")

    return {
        'message': 'Registration successful.',
        'access_token': access_token,
        'user': new_user.to_dict()
    }, 201


def login_user_service(email, password):
    from services.notification_service import create_notification

    if not email or not password:
        return {'error': 'Email and password are required.'}, 400

    email_clean = email.strip().lower()
    logger.info(f"[AUTH] Login request received")
    logger.info(f"[AUTH] Normalized email: {email_clean}")

    # Case-insensitive user lookup
    user = User.query.filter(db.func.lower(User.email) == email_clean).first()
    logger.info(f"[AUTH] User found: {bool(user)}")

    is_valid_pw = False
    if user and user.password_hash:
        try:
            is_valid_pw = bcrypt.check_password_hash(user.password_hash, password)
        except Exception as e:
            logger.error(f"[AUTH-PW-CHECK-ERROR] Error checking password hash: {e}")
            is_valid_pw = False

    logger.info(f"[AUTH] Password verification: {'success' if is_valid_pw else 'failure'}")

    if not user or not is_valid_pw:
        logger.warning(f"[AUTH-LOGIN-FAILED] Invalid login attempt for: {email_clean}")
        if user:
            create_notification(
                user_id=user.id,
                notif_type='ERROR',
                title='Failed Login Attempt',
                message=f'Invalid password entered for {email_clean}.',
                severity='ERROR',
                resource_type='AUTH'
            )
        return {'error': 'Invalid email or password.'}, 401

    access_token = create_access_token(identity=str(user.id))
    logger.info(f"[AUTH] JWT creation: success")
    logger.info(f"[AUTH-LOGIN-SUCCESS] User logged in: {email_clean} (ID: {user.id})")

    create_notification(
        user_id=user.id,
        notif_type='SUCCESS',
        title='Successful Login',
        message=f'Welcome back {user.name}! Signed in to CloudOps Enterprise.',
        severity='SUCCESS',
        resource_type='AUTH'
    )

    return {
        'message': 'Login successful.',
        'access_token': access_token,
        'user': user.to_dict()
    }, 200


def reset_password_service(email, master_key, new_password):
    """Resets user password using backend Master Reset Key validation."""
    from services.notification_service import create_notification

    if not email or not master_key or not new_password:
        return {'error': 'Email, Master Reset Key, and New Password are required.'}, 400

    email_clean = email.strip().lower()
    user = User.query.filter(db.func.lower(User.email) == email_clean).first()
    if not user:
        return {'error': 'User not found with this email address.'}, 404

    if master_key.strip() != MASTER_RESET_KEY:
        logger.warning(f"[AUTH-RESET-FAILED] Invalid Master Reset Key attempt for: {email_clean}")
        create_notification(
            user_id=user.id,
            notif_type='ERROR',
            title='Password Reset Failed',
            message='Invalid Master Reset Key provided during password reset attempt.',
            severity='ERROR',
            resource_type='AUTH'
        )
        return {'error': 'Invalid Master Reset Key.'}, 400

    if len(new_password) < 6:
        return {'error': 'New password must be at least 6 characters long.'}, 400

    new_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
    user.password_hash = new_hash
    db.session.commit()

    logger.info(f"[AUTH-RESET-SUCCESS] Password reset successfully for user: {email_clean}")

    create_notification(
        user_id=user.id,
        notif_type='SUCCESS',
        title='Password Reset Completed',
        message='Your account password was updated successfully.',
        severity='SUCCESS',
        resource_type='AUTH'
    )

    return {
        'message': 'Password Updated Successfully. Please sign in with your new password.'
    }, 200


def update_profile_service(user, name, email):
    if not name or not email:
        return {'error': 'Name and Email cannot be empty.'}, 400

    clean_name = name.strip()
    email_clean = email.strip().lower()

    logger.info(f"[PROFILE] Update request received")
    logger.info(f"[PROFILE] Authenticated user ID: {user.id}")
    logger.info(f"[PROFILE] Updating profile")

    try:
        if email_clean != user.email.lower():
            # Check duplicate email case-insensitively across other users
            existing = User.query.filter(db.func.lower(User.email) == email_clean).first()
            if existing and existing.id != user.id:
                logger.warning(f"[PROFILE] Update conflict: Email {email_clean} already owned by user ID {existing.id}")
                return {'error': 'Email address is already in use.', 'message': 'Email address is already in use.'}, 409
            user.email = email_clean

        user.name = clean_name
        db.session.commit()

        logger.info(f"[PROFILE] Database commit successful")
        logger.info(f"[PROFILE] Profile update response sent")

        return {
            'message': 'Profile updated successfully.',
            'user': user.to_dict()
        }, 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"[PROFILE] Update failed")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        return {'error': f'Failed to update profile: {str(e)}', 'message': 'Failed to update profile.'}, 500


def change_password_service(user, current_password, new_password):
    if not current_password or not new_password:
        return {'error': 'Current and new password are required.'}, 400

    if not bcrypt.check_password_hash(user.password_hash, current_password):
        return {'error': 'Current password is incorrect.'}, 400

    if len(new_password) < 6:
        return {'error': 'New password must be at least 6 characters long.'}, 400

    try:
        user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
        db.session.commit()
        return {'message': 'Password updated successfully.'}, 200
    except Exception as e:
        db.session.rollback()
        return {'error': f'Failed to change password: {str(e)}'}, 500

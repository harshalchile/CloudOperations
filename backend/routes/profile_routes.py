from flask import Blueprint
from controllers.profile_controller import (
    update_profile_controller,
    change_password_controller
)
from middleware.jwt_auth import jwt_required_custom

profile_bp = Blueprint('profile', __name__, url_prefix='/api')

profile_bp.route('/profile', methods=['PUT'])(jwt_required_custom(update_profile_controller))
profile_bp.route('/change-password', methods=['PUT'])(jwt_required_custom(change_password_controller))

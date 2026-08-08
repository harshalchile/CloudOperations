from flask import Blueprint
from controllers.profile_controller import (
    update_profile_controller,
    change_password_controller
)
from middleware.jwt_auth import jwt_required_custom

profile_bp = Blueprint('profile', __name__, url_prefix='/api')

profile_bp.route('/profile', methods=['PUT'], endpoint='update_profile')(jwt_required_custom(update_profile_controller))
profile_bp.route('/auth/profile', methods=['PUT'], endpoint='auth_update_profile')(jwt_required_custom(update_profile_controller))
profile_bp.route('/change-password', methods=['PUT'], endpoint='change_password')(jwt_required_custom(change_password_controller))
profile_bp.route('/auth/change-password', methods=['PUT'], endpoint='auth_change_password')(jwt_required_custom(change_password_controller))

from flask import Blueprint
from controllers.auth_controller import (
    register_controller,
    login_controller,
    logout_controller,
    get_me_controller
)
from middleware.jwt_auth import jwt_required_custom

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

auth_bp.route('/register', methods=['POST'])(register_controller)
auth_bp.route('/login', methods=['POST'])(login_controller)
auth_bp.route('/logout', methods=['POST'])(jwt_required_custom(logout_controller))
auth_bp.route('/me', methods=['GET'])(jwt_required_custom(get_me_controller))

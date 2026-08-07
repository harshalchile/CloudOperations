from flask import Blueprint
from controllers.ec2_controller import (
    list_ec2_controller,
    start_ec2_controller,
    stop_ec2_controller,
    reboot_ec2_controller,
    terminate_ec2_controller,
    create_ec2_controller,
    get_windows_password_controller,
    download_rdp_controller
)
from middleware.jwt_auth import jwt_required_custom

ec2_bp = Blueprint('ec2', __name__, url_prefix='/api/ec2')

ec2_bp.route('', methods=['GET'])(jwt_required_custom(list_ec2_controller))
ec2_bp.route('/start', methods=['POST'])(jwt_required_custom(start_ec2_controller))
ec2_bp.route('/stop', methods=['POST'])(jwt_required_custom(stop_ec2_controller))
ec2_bp.route('/reboot', methods=['POST'])(jwt_required_custom(reboot_ec2_controller))
ec2_bp.route('/terminate', methods=['POST'])(jwt_required_custom(terminate_ec2_controller))
ec2_bp.route('/create', methods=['POST'])(jwt_required_custom(create_ec2_controller))
ec2_bp.route('/windows-password', methods=['POST'])(jwt_required_custom(get_windows_password_controller))
ec2_bp.route('/download-rdp', methods=['POST', 'GET'])(jwt_required_custom(download_rdp_controller))

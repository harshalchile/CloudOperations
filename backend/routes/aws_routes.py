from flask import Blueprint
from controllers.aws_controller import (
    list_accounts_controller,
    add_account_controller,
    update_account_controller,
    test_account_controller,
    delete_account_controller,
    get_dashboard_stats_controller,
    test_aws_controller,
    connect_aws_controller,
    get_aws_status_controller,
    get_diagnostics_controller
)

aws_bp = Blueprint('aws', __name__, url_prefix='/api/aws')

aws_bp.route('/accounts', methods=['GET'])(list_accounts_controller)
aws_bp.route('/accounts', methods=['POST'])(add_account_controller)
aws_bp.route('/accounts/<int:account_id>', methods=['PUT'])(update_account_controller)
aws_bp.route('/accounts/<int:account_id>/test', methods=['POST'])(test_account_controller)
aws_bp.route('/accounts/<int:account_id>', methods=['DELETE'])(delete_account_controller)
aws_bp.route('/dashboard', methods=['GET'])(get_dashboard_stats_controller)
aws_bp.route('/diagnostics', methods=['GET'])(get_diagnostics_controller)

# Backwards compatibility routes
aws_bp.route('/test', methods=['POST'])(test_aws_controller)
aws_bp.route('/connect', methods=['POST'])(connect_aws_controller)
aws_bp.route('/status', methods=['GET'])(get_aws_status_controller)
aws_bp.route('/update', methods=['PUT'])(add_account_controller)
aws_bp.route('/remove', methods=['DELETE'])(delete_account_controller)

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
    get_aws_status_controller
)
from controllers.cloudwatch_controller import get_ec2_instance_metrics_controller
from controllers.ec2_controller import list_ec2_controller
from middleware.jwt_auth import jwt_required_custom

aws_bp = Blueprint('aws', __name__, url_prefix='/api/aws')

aws_bp.route('/accounts', methods=['GET'], endpoint='list_accounts')(jwt_required_custom(list_accounts_controller))
aws_bp.route('/accounts', methods=['POST'], endpoint='add_account')(jwt_required_custom(add_account_controller))
aws_bp.route('/accounts/<int:account_id>', methods=['PUT'], endpoint='update_account')(jwt_required_custom(update_account_controller))
aws_bp.route('/accounts/<int:account_id>/test', methods=['POST'], endpoint='test_account')(jwt_required_custom(test_account_controller))
aws_bp.route('/accounts/<int:account_id>', methods=['DELETE'], endpoint='delete_account')(jwt_required_custom(delete_account_controller))
aws_bp.route('/dashboard', methods=['GET'], endpoint='get_dashboard')(jwt_required_custom(get_dashboard_stats_controller))

# Backwards compatibility routes
aws_bp.route('/test', methods=['POST'], endpoint='test_aws')(jwt_required_custom(test_aws_controller))
aws_bp.route('/connect', methods=['POST'], endpoint='connect_aws')(jwt_required_custom(connect_aws_controller))
aws_bp.route('/status', methods=['GET'], endpoint='get_aws_status')(jwt_required_custom(get_aws_status_controller))
aws_bp.route('/update', methods=['PUT'], endpoint='update_aws')(jwt_required_custom(add_account_controller))
aws_bp.route('/remove', methods=['DELETE'], endpoint='remove_aws')(jwt_required_custom(delete_account_controller))

aws_bp.route('/cloudwatch/ec2/<instance_id>/metrics', methods=['GET'], endpoint='aws_cw_metrics')(jwt_required_custom(get_ec2_instance_metrics_controller))
aws_bp.route('/ec2/instances', methods=['GET'], endpoint='aws_ec2_instances')(jwt_required_custom(list_ec2_controller))

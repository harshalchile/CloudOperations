from flask import Blueprint
from controllers.cloudwatch_controller import (
    get_cloudwatch_dashboard_controller,
    list_cloudwatch_alarms_controller,
    get_alarm_details_controller,
    list_log_groups_controller,
    list_log_streams_controller,
    get_log_events_controller,
    list_cloudwatch_metrics_controller,
    get_metric_stats_controller,
    get_ec2_resources_controller
)
from middleware.jwt_auth import jwt_required_custom

cloudwatch_bp = Blueprint('cloudwatch', __name__, url_prefix='/api/cloudwatch')

cloudwatch_bp.route('/dashboard', methods=['GET'])(jwt_required_custom(get_cloudwatch_dashboard_controller))
cloudwatch_bp.route('/alarms', methods=['GET'])(jwt_required_custom(list_cloudwatch_alarms_controller))
cloudwatch_bp.route('/alarms/<path:alarm_name>', methods=['GET'])(jwt_required_custom(get_alarm_details_controller))
cloudwatch_bp.route('/log-groups', methods=['GET'])(jwt_required_custom(list_log_groups_controller))
cloudwatch_bp.route('/log-streams', methods=['GET'])(jwt_required_custom(list_log_streams_controller))
cloudwatch_bp.route('/log-events', methods=['GET'])(jwt_required_custom(get_log_events_controller))
cloudwatch_bp.route('/metrics/list', methods=['GET'])(jwt_required_custom(list_cloudwatch_metrics_controller))
cloudwatch_bp.route('/metrics/stats', methods=['GET'])(jwt_required_custom(get_metric_stats_controller))
cloudwatch_bp.route('/ec2-instances', methods=['GET'])(jwt_required_custom(get_ec2_resources_controller))

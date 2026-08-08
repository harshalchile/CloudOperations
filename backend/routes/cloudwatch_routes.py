from flask import Blueprint
from controllers.cloudwatch_controller import (
    get_cloudwatch_stats_controller,
    get_ec2_metrics_controller,
    list_ec2_alarms_controller,
    create_ec2_alarm_controller,
    delete_ec2_alarm_controller,
    get_ec2_health_controller,
    get_s3_metrics_controller,
    get_s3_buckets_controller,
    create_s3_watch_controller,
    list_s3_watches_controller,
    delete_s3_watch_controller
)
from controllers.ec2_controller import list_ec2_controller
from middleware.jwt_auth import jwt_required_custom

cloudwatch_bp = Blueprint('cloudwatch', __name__, url_prefix='/api/cloudwatch')

# Dashboard Stats
cloudwatch_bp.route('/stats', methods=['GET'])(jwt_required_custom(get_cloudwatch_stats_controller))

# EC2 Scope Endpoints
cloudwatch_bp.route('/ec2-instances', methods=['GET'], endpoint='cw_list_ec2_instances')(jwt_required_custom(list_ec2_controller))
cloudwatch_bp.route('/ec2/instances', methods=['GET'], endpoint='cw_list_ec2_instances_alt')(jwt_required_custom(list_ec2_controller))
cloudwatch_bp.route('/ec2/<instance_id>/metrics', methods=['GET'])(jwt_required_custom(get_ec2_metrics_controller))
cloudwatch_bp.route('/ec2/alarms', methods=['GET'])(jwt_required_custom(list_ec2_alarms_controller))
cloudwatch_bp.route('/ec2/alarms', methods=['POST'])(jwt_required_custom(create_ec2_alarm_controller))
cloudwatch_bp.route('/ec2/alarms/<alarm_name>', methods=['DELETE'])(jwt_required_custom(delete_ec2_alarm_controller))
cloudwatch_bp.route('/ec2/health', methods=['GET'])(jwt_required_custom(get_ec2_health_controller))

# S3 Scope Endpoints
cloudwatch_bp.route('/s3/metrics', methods=['GET'])(jwt_required_custom(get_s3_metrics_controller))
cloudwatch_bp.route('/s3/buckets', methods=['GET'])(jwt_required_custom(get_s3_buckets_controller))
cloudwatch_bp.route('/s3/watch', methods=['POST'])(jwt_required_custom(create_s3_watch_controller))
cloudwatch_bp.route('/s3/watch', methods=['GET'])(jwt_required_custom(list_s3_watches_controller))
cloudwatch_bp.route('/s3/watch/<int:watch_id>', methods=['DELETE'])(jwt_required_custom(delete_s3_watch_controller))

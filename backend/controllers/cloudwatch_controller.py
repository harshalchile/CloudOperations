from flask import request, jsonify
from services.cloudwatch_service import (
    get_cloudwatch_dashboard_stats_service,
    list_alarms_service,
    get_alarm_details_service,
    list_log_groups_service,
    list_log_streams_service,
    get_log_events_service,
    list_metrics_service,
    get_metric_statistics_service,
    get_ec2_resources_service
)

def get_cloudwatch_dashboard_controller(current_user):
    response, status = get_cloudwatch_dashboard_stats_service(current_user)
    return jsonify(response), status

def list_cloudwatch_alarms_controller(current_user):
    state_filter = request.args.get('state')
    response, status = list_alarms_service(current_user, state_filter=state_filter)
    return jsonify(response), status

def get_alarm_details_controller(current_user, alarm_name):
    response, status = get_alarm_details_service(current_user, alarm_name)
    return jsonify(response), status

def list_log_groups_controller(current_user):
    response, status = list_log_groups_service(current_user)
    return jsonify(response), status

def list_log_streams_controller(current_user):
    log_group_name = request.args.get('log_group_name') or request.args.get('logGroupName')
    if not log_group_name:
        return jsonify({'error': 'Parameter log_group_name is required.'}), 400
    response, status = list_log_streams_service(current_user, log_group_name)
    return jsonify(response), status

def get_log_events_controller(current_user):
    log_group_name = request.args.get('log_group_name') or request.args.get('logGroupName')
    log_stream_name = request.args.get('log_stream_name') or request.args.get('logStreamName')
    limit = request.args.get('limit', 100)

    if not log_group_name or not log_stream_name:
        return jsonify({'error': 'Parameters log_group_name and log_stream_name are required.'}), 400

    response, status = get_log_events_service(current_user, log_group_name, log_stream_name, limit)
    return jsonify(response), status

def list_cloudwatch_metrics_controller(current_user):
    namespace = request.args.get('namespace')
    response, status = list_metrics_service(current_user, namespace=namespace)
    return jsonify(response), status

def get_metric_stats_controller(current_user):
    namespace = request.args.get('namespace', 'AWS/EC2')
    metric_name = request.args.get('metric_name', 'CPUUtilization')
    time_range = request.args.get('time_range', '1h')
    dimension_name = request.args.get('dimension_name')
    dimension_value = request.args.get('dimension_value')
    stat = request.args.get('stat', 'Average')

    response, status = get_metric_statistics_service(
        current_user,
        namespace=namespace,
        metric_name=metric_name,
        time_range=time_range,
        dimension_name=dimension_name,
        dimension_value=dimension_value,
        stat=stat
    )
    return jsonify(response), status

def get_ec2_resources_controller(current_user):
    response, status = get_ec2_resources_service(current_user)
    return jsonify(response), status

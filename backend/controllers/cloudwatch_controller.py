from flask import request, jsonify
from services.cloudwatch_service import (
    get_cloudwatch_dashboard_stats_service,
    get_ec2_instance_metrics_service,
    put_ec2_cpu_alarm_service,
    list_ec2_alarms_service,
    delete_ec2_alarm_service,
    check_ec2_health_watch_service,
    get_s3_metrics_service,
    get_s3_buckets_service,
    create_s3_watch_service,
    list_s3_watches_service,
    delete_s3_watch_service,
    check_s3_storage_watches_service
)

def get_cloudwatch_stats_controller(current_user):
    account_id = request.args.get('account_id') or request.args.get('aws_account_id')
    res, status = get_cloudwatch_dashboard_stats_service(current_user, requested_account_id=account_id)
    return jsonify(res), status

def get_ec2_metrics_controller(current_user, instance_id):
    metric = request.args.get('metric')
    time_range = request.args.get('time_range', '1h')
    account_id = request.args.get('account_id') or request.args.get('aws_account_id')
    res, status = get_ec2_instance_metrics_service(current_user, instance_id, metric=metric, time_range=time_range, requested_account_id=account_id)
    return jsonify(res), status

get_ec2_instance_metrics_controller = get_ec2_metrics_controller

def list_ec2_alarms_controller(current_user):
    account_id = request.args.get('account_id') or request.args.get('aws_account_id')
    res, status = list_ec2_alarms_service(current_user, requested_account_id=account_id)
    return jsonify(res), status

def create_ec2_alarm_controller(current_user):
    data = request.get_json() or {}
    alarm_name = data.get('alarm_name') or data.get('alarmName')
    instance_id = data.get('instance_id') or data.get('instanceId')
    threshold = data.get('threshold')
    period = data.get('period', 300)
    comparison_operator = data.get('comparison_operator', 'GreaterThanThreshold')
    account_id = data.get('account_id') or data.get('aws_account_id') or request.args.get('account_id')

    res, status = put_ec2_cpu_alarm_service(
        current_user,
        alarm_name=alarm_name,
        instance_id=instance_id,
        threshold=threshold,
        period=period,
        comparison_operator=comparison_operator,
        requested_account_id=account_id
    )
    return jsonify(res), status

def delete_ec2_alarm_controller(current_user, alarm_name):
    account_id = request.args.get('account_id') or request.args.get('aws_account_id')
    res, status = delete_ec2_alarm_service(current_user, alarm_name, requested_account_id=account_id)
    return jsonify(res), status

def get_ec2_health_controller(current_user):
    account_id = request.args.get('account_id') or request.args.get('aws_account_id')
    res, status = check_ec2_health_watch_service(current_user, requested_account_id=account_id)
    return jsonify(res), status

def get_s3_metrics_controller(current_user):
    bucket_name = request.args.get('bucket_name') or request.args.get('bucket')
    time_range = request.args.get('time_range', '1h')
    account_id = request.args.get('account_id') or request.args.get('aws_account_id')
    res, status = get_s3_metrics_service(current_user, bucket_name=bucket_name, time_range=time_range, requested_account_id=account_id)
    return jsonify(res), status

def get_s3_buckets_controller(current_user):
    account_id = request.args.get('account_id') or request.args.get('aws_account_id')
    res, status = get_s3_buckets_service(current_user, requested_account_id=account_id)
    return jsonify(res), status

def create_s3_watch_controller(current_user):
    data = request.get_json() or {}
    bucket_name = data.get('bucket_name') or data.get('bucketName')
    threshold_gb = data.get('threshold_gb') or data.get('thresholdGb')
    account_id = data.get('account_id') or data.get('aws_account_id') or request.args.get('account_id')

    res, status = create_s3_watch_service(current_user, bucket_name, threshold_gb, requested_account_id=account_id)
    return jsonify(res), status

def list_s3_watches_controller(current_user):
    account_id = request.args.get('account_id') or request.args.get('aws_account_id')
    # Run evaluation check
    check_s3_storage_watches_service(current_user)
    res, status = list_s3_watches_service(current_user, requested_account_id=account_id)
    return jsonify(res), status

def delete_s3_watch_controller(current_user, watch_id):
    res, status = delete_s3_watch_service(current_user, watch_id)
    return jsonify(res), status

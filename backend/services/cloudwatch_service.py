import boto3
import logging
from datetime import datetime, timedelta, timezone
from botocore.exceptions import ClientError
from models.user import db
from models.s3_watch import S3StorageWatch
from models.alarm_state import AlarmStateTrack
from services.aws_service import get_target_aws_accounts
from services.notification_service import create_notification
from utils.aws_client_manager import AWSClientManager

logger = logging.getLogger("cloudwatch_service")

DEFAULT_REGION = 'ap-south-1'


def resolve_time_range_params(time_range):
    now = datetime.now(timezone.utc)
    tr = str(time_range).lower() if time_range else '1h'

    if tr == '5m':
        start_time = now - timedelta(minutes=5)
        period = 60
    elif tr == '15m':
        start_time = now - timedelta(minutes=15)
        period = 60
    elif tr == '1h':
        start_time = now - timedelta(hours=1)
        period = 60
    elif tr == '3h':
        start_time = now - timedelta(hours=3)
        period = 300
    elif tr == '6h':
        start_time = now - timedelta(hours=6)
        period = 300
    elif tr == '12h':
        start_time = now - timedelta(hours=12)
        period = 900
    elif tr == '24h':
        start_time = now - timedelta(hours=24)
        period = 900
    elif tr == '7d':
        start_time = now - timedelta(days=7)
        period = 3600
    else:
        start_time = now - timedelta(hours=1)
        period = 60

    return start_time, now, period


METRIC_CONFIG = {
    'CPUUtilization': {'stat': 'Average', 'unit': 'Percent', 'label': 'CPU Utilization'},
    'NetworkIn': {'stat': 'Sum', 'unit': 'Bytes', 'label': 'Network In'},
    'NetworkOut': {'stat': 'Sum', 'unit': 'Bytes', 'label': 'Network Out'},
    'DiskReadBytes': {'stat': 'Sum', 'unit': 'Bytes', 'label': 'Disk Read'},
    'DiskWriteBytes': {'stat': 'Sum', 'unit': 'Bytes', 'label': 'Disk Write'},
    'DiskReadOps': {'stat': 'Sum', 'unit': 'Count', 'label': 'Disk Read Ops'},
    'DiskWriteOps': {'stat': 'Sum', 'unit': 'Count', 'label': 'Disk Write Ops'},
    'StatusCheckFailed': {'stat': 'Maximum', 'unit': 'Count', 'label': 'Status Check Failed'},
    'StatusCheckFailed_System': {'stat': 'Maximum', 'unit': 'Count', 'label': 'System Status Check Failed'},
    'StatusCheckFailed_Instance': {'stat': 'Maximum', 'unit': 'Count', 'label': 'Instance Status Check Failed'},
}


def get_cloudwatch_dashboard_stats_service(user, requested_account_id=None):
    """Returns top-level CloudWatch summary stats strictly for EC2 & S3."""
    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')

    if not accounts:
        return {
            'total_alarms': 0,
            'alarms_in_alarm': 0,
            'alarms_in_ok': 0,
            'alarms_insufficient_data': 0,
            'total_s3_watches': 0,
            's3_watches_exceeded': 0,
            'last_sync_time': now_iso,
            'accounts_count': 0
        }, 200

    alarms_res, _ = list_ec2_alarms_service(user, requested_account_id=requested_account_id)
    alarms = alarms_res.get('alarms', [])

    in_alarm = sum(1 for a in alarms if a.get('state_value') == 'ALARM')
    in_ok = sum(1 for a in alarms if a.get('state_value') == 'OK')
    in_insufficient = sum(1 for a in alarms if a.get('state_value') == 'INSUFFICIENT_DATA')

    watches_res, _ = list_s3_watches_service(user, requested_account_id=requested_account_id)
    watches = watches_res.get('watches', [])
    s3_exceeded = sum(1 for w in watches if w.get('last_state') == 'EXCEEDED')

    return {
        'total_alarms': len(alarms),
        'alarms_in_alarm': in_alarm,
        'alarms_in_ok': in_ok,
        'alarms_insufficient_data': in_insufficient,
        'total_s3_watches': len(watches),
        's3_watches_exceeded': s3_exceeded,
        'last_sync_time': now_iso,
        'accounts_count': len(accounts)
    }, 200


def fetch_single_instance_metric(cw_client, target_acc, region, instance_id, metric_name, start_time, end_time, period, time_range):
    cfg = METRIC_CONFIG.get(metric_name, {'stat': 'Average', 'unit': 'Count', 'label': metric_name})
    stat_key = cfg['stat']

    kwargs = {
        'Namespace': 'AWS/EC2',
        'MetricName': metric_name,
        'Dimensions': [{'Name': 'InstanceId', 'Value': instance_id}],
        'StartTime': start_time,
        'EndTime': end_time,
        'Period': period,
        'Statistics': [stat_key]
    }

    res, err_call, _ = AWSClientManager.execute_aws_call(
        cw_client, 'cloudwatch', 'get_metric_statistics', target_acc, region, 'get_metric_statistics',
        **kwargs
    )

    if err_call and target_acc and hasattr(target_acc, 'user_id'):
        err_msg = err_call.get('aws_error_message') or err_call.get('error')
        create_notification(
            user_id=target_acc.user_id,
            notif_type='ERROR',
            title='CloudWatch API Error',
            message=f'Unable to retrieve CloudWatch metrics for instance {instance_id}: {err_msg}',
            severity='ERROR',
            resource_type='CLOUDWATCH',
            resource_id=instance_id,
            aws_account_id=target_acc.id
        )

    datapoints = []
    latest_val = None
    min_val = None
    max_val = None
    avg_val = None

    if res and res.get('Datapoints'):
        raw_dps = res['Datapoints']
        raw_dps.sort(key=lambda x: x.get('Timestamp'))

        vals = []
        for dp in raw_dps:
            ts = dp.get('Timestamp')
            if not ts:
                continue
            val = dp.get(stat_key, 0.0)
            vals.append(val)
            ts_str = ts.strftime('%Y-%m-%d %H:%M')
            lbl = ts.strftime('%H:%M') if time_range in ['5m', '15m', '1h', '3h', '6h', '12h'] else ts.strftime('%m-%d %H:%M')

            datapoints.append({
                'timestamp': ts_str,
                'label': lbl,
                'value': round(val, 2)
            })

        if vals:
            latest_val = round(vals[-1], 2)
            min_val = round(min(vals), 2)
            max_val = round(max(vals), 2)
            avg_val = round(sum(vals) / len(vals), 2)

    return {
        'instance_id': instance_id,
        'metric': metric_name,
        'metric_name': metric_name,
        'label': cfg['label'],
        'unit': cfg['unit'],
        'statistic': stat_key,
        'time_range': time_range,
        'period': period,
        'current_value': latest_val,
        'average_value': avg_val,
        'minimum_value': min_val,
        'maximum_value': max_val,
        'has_data': bool(datapoints),
        'datapoints': datapoints
    }


def get_ec2_instance_metrics_service(user, instance_id, metric=None, time_range='1h', requested_account_id=None):
    """Fetches real AWS/EC2 metrics for a specific instance."""
    from services.ec2_service import get_ec2_client_for_instance

    if not instance_id:
        return {'error': 'instance_id is required.', 'code': 'InvalidInstanceID'}, 400

    ec2_cli, region, target_acc, err, status_code = get_ec2_client_for_instance(user, instance_id, requested_account_id=requested_account_id)
    if err or not target_acc:
        return err, status_code

    start_time, end_time, period = resolve_time_range_params(time_range)

    cw_client, region, target_acc, err_cw, status_cw = AWSClientManager.get_client(user, 'cloudwatch', requested_account_id=target_acc.id, req_region=DEFAULT_REGION)
    if err_cw or not cw_client:
        return err_cw, status_cw

    if metric and metric != 'all' and metric in METRIC_CONFIG:
        metric_data = fetch_single_instance_metric(cw_client, target_acc, region, instance_id, metric, start_time, end_time, period, time_range)
        return metric_data, 200

    all_metrics = {}
    metrics_to_fetch = ['CPUUtilization', 'NetworkIn', 'NetworkOut', 'DiskReadBytes', 'DiskWriteBytes', 'DiskReadOps', 'DiskWriteOps', 'StatusCheckFailed']

    for m in metrics_to_fetch:
        all_metrics[m] = fetch_single_instance_metric(cw_client, target_acc, region, instance_id, m, start_time, end_time, period, time_range)

    return {
        'instance_id': instance_id,
        'account_name': target_acc.account_name,
        'account_id': target_acc.account_id,
        'time_range': time_range,
        'period': period,
        'metrics': all_metrics
    }, 200


def put_ec2_cpu_alarm_service(user, alarm_name, instance_id, threshold, period=300, comparison_operator='GreaterThanThreshold', requested_account_id=None):
    """Creates a real AWS EC2 CPU Utilization CloudWatch Alarm using put_metric_alarm()."""
    if not alarm_name or not str(alarm_name).strip():
        return {'error': 'Alarm Name is required.', 'code': 'InvalidParameterValue'}, 400

    if not instance_id or not str(instance_id).strip():
        return {'error': 'EC2 Instance ID is required.', 'code': 'InvalidParameterValue'}, 400

    try:
        threshold_val = float(threshold)
    except (ValueError, TypeError):
        return {'error': 'CPU Threshold must be a valid number.', 'code': 'InvalidParameterValue'}, 400

    from services.ec2_service import get_ec2_client_for_instance
    _, region, target_acc, err, status_code = get_ec2_client_for_instance(user, instance_id, requested_account_id=requested_account_id)
    if err or not target_acc:
        return err, status_code

    cw_client, region, target_acc, err_cw, status_cw = AWSClientManager.get_client(user, 'cloudwatch', requested_account_id=target_acc.id, req_region=DEFAULT_REGION)
    if err_cw or not cw_client:
        return err_cw, status_cw

    clean_alarm_name = str(alarm_name).strip()
    clean_operator = comparison_operator if comparison_operator in [
        'GreaterThanThreshold', 'GreaterThanOrEqualToThreshold', 'LessThanThreshold', 'LessThanOrEqualToThreshold'
    ] else 'GreaterThanThreshold'

    try:
        period_val = int(period)
    except (ValueError, TypeError):
        period_val = 300

    kwargs = {
        'AlarmName': clean_alarm_name,
        'AlarmDescription': f'High CPU Utilization alert for EC2 instance {instance_id}',
        'ActionsEnabled': False,
        'MetricName': 'CPUUtilization',
        'Namespace': 'AWS/EC2',
        'Statistic': 'Average',
        'Dimensions': [{'Name': 'InstanceId', 'Value': instance_id}],
        'Period': period_val,
        'EvaluationPeriods': 1,
        'Threshold': threshold_val,
        'ComparisonOperator': clean_operator
    }

    res, err_call, sc = AWSClientManager.execute_aws_call(
        cw_client, 'cloudwatch', 'put_metric_alarm', target_acc, region, 'put_metric_alarm',
        **kwargs
    )
    if err_call:
        err_msg = err_call.get('aws_error_message') or err_call.get('error')
        create_notification(
            user_id=user.id,
            notif_type='ERROR',
            title='Alarm Creation Failed',
            message=f'Failed to create CloudWatch alarm "{clean_alarm_name}": {err_msg}',
            severity='ERROR',
            resource_type='CLOUDWATCH',
            resource_id=instance_id,
            aws_account_id=target_acc.id
        )
        return err_call, sc

    # Verify alarm creation immediately with describe_alarms()
    verify_res, v_err, _ = AWSClientManager.execute_aws_call(
        cw_client, 'cloudwatch', 'describe_alarms', target_acc, region, 'describe_alarms',
        AlarmNames=[clean_alarm_name]
    )
    if v_err or not verify_res or not verify_res.get('MetricAlarms'):
        err_msg = v_err.get('aws_error_message') or v_err.get('error') if v_err else 'Alarm creation could not be verified in AWS CloudWatch.'
        create_notification(
            user_id=user.id,
            notif_type='ERROR',
            title='Alarm Verification Failed',
            message=f'Failed to verify CloudWatch alarm "{clean_alarm_name}": {err_msg}',
            severity='ERROR',
            resource_type='CLOUDWATCH',
            resource_id=instance_id,
            aws_account_id=target_acc.id
        )
        return {'error': f'Failed to verify CloudWatch alarm in AWS: {err_msg}'}, 500

    # Initialize AlarmStateTrack
    track = AlarmStateTrack.query.filter_by(user_id=user.id, aws_account_id=target_acc.id, alarm_name=clean_alarm_name).first()
    if not track:
        track = AlarmStateTrack(
            user_id=user.id,
            aws_account_id=target_acc.id,
            alarm_name=clean_alarm_name,
            resource_id=instance_id,
            track_type='CPU_ALARM',
            last_state='OK'
        )
        db.session.add(track)
    else:
        track.resource_id = instance_id
    db.session.commit()

    create_notification(
        user_id=user.id,
        notif_type='SUCCESS',
        title='CPU Alarm Created',
        message=f'EC2 CPU alarm created successfully for instance {instance_id} in {target_acc.account_name}.',
        severity='SUCCESS',
        resource_type='CLOUDWATCH',
        resource_id=instance_id,
        aws_account_id=target_acc.id
    )

    return {
        'message': f'EC2 CPU alarm created successfully.',
        'alarm_name': clean_alarm_name,
        'instance_id': instance_id,
        'threshold': threshold_val,
        'aws_account_name': target_acc.account_name,
        'aws_account_id': target_acc.id
    }, 201


def list_ec2_alarms_service(user, requested_account_id=None):
    """Lists real CloudWatch EC2 alarms via describe_alarms() and handles state-change notifications without duplicates."""
    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    if not accounts:
        return {'alarms': [], 'count': 0}, 200

    all_alarms = []
    errors = []

    for acc in accounts:
        cw_client, region, target_acc, err, _ = AWSClientManager.get_client(user, 'cloudwatch', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        if err or not cw_client:
            errors.append(f"Account '{acc.account_name}': {err.get('error') if isinstance(err, dict) else err}")
            continue

        res, err_call, _ = AWSClientManager.execute_aws_call(
            cw_client, 'cloudwatch', 'describe_alarms', target_acc, region, 'describe_alarms'
        )
        if err_call or not res:
            if err_call:
                errors.append(f"Account '{acc.account_name}': {err_call.get('error')}")
            continue

        metric_alarms = res.get('MetricAlarms', [])
        for a in metric_alarms:
            # Scope check: Only include AWS/EC2 namespace or CPUUtilization
            ns = a.get('Namespace', '')
            if ns and ns != 'AWS/EC2':
                continue

            a_name = a.get('AlarmName')
            a_state = a.get('StateValue', 'INSUFFICIENT_DATA')
            threshold = a.get('Threshold')
            instance_id = 'N/A'

            for d in a.get('Dimensions', []):
                if d.get('Name') == 'InstanceId':
                    instance_id = d.get('Value')

            # State Change Evaluation with AlarmStateTrack
            track = AlarmStateTrack.query.filter_by(
                user_id=user.id,
                aws_account_id=acc.id,
                alarm_name=a_name,
                track_type='CPU_ALARM'
            ).first()

            if not track:
                track = AlarmStateTrack(
                    user_id=user.id,
                    aws_account_id=acc.id,
                    alarm_name=a_name,
                    resource_id=instance_id,
                    track_type='CPU_ALARM',
                    last_state=a_state
                )
                db.session.add(track)
                db.session.commit()
            elif track.last_state != a_state:
                # Trigger Notification ONLY on State Change
                old_state = track.last_state
                track.last_state = a_state
                db.session.commit()

                if old_state == 'OK' and a_state == 'ALARM':
                    create_notification(
                        user_id=user.id,
                        notif_type='WARNING',
                        title='EC2 CPU Alarm Triggered',
                        message=f'CPU utilization for instance {instance_id} in {acc.account_name} exceeded threshold ({threshold}%).',
                        severity='WARNING',
                        resource_type='CLOUDWATCH',
                        resource_id=instance_id,
                        aws_account_id=acc.id
                    )
                elif old_state == 'ALARM' and a_state == 'OK':
                    create_notification(
                        user_id=user.id,
                        notif_type='SUCCESS',
                        title='EC2 CPU Alarm Recovered',
                        message=f'CPU utilization for instance {instance_id} in {acc.account_name} returned below the threshold.',
                        severity='SUCCESS',
                        resource_type='CLOUDWATCH',
                        resource_id=instance_id,
                        aws_account_id=acc.id
                    )

            state_updated = a.get('StateUpdatedTimestamp')
            state_updated_str = state_updated.strftime('%Y-%m-%d %H:%M:%S UTC') if isinstance(state_updated, datetime) else str(state_updated or 'N/A')

            all_alarms.append({
                'alarm_name': a_name,
                'alarm_arn': a.get('AlarmArn'),
                'description': a.get('AlarmDescription', ''),
                'namespace': ns or 'AWS/EC2',
                'metric_name': a.get('MetricName', 'CPUUtilization'),
                'statistic': a.get('Statistic', 'Average'),
                'threshold': threshold,
                'comparison_operator': a.get('ComparisonOperator', 'GreaterThanThreshold'),
                'period': a.get('Period', 300),
                'state_value': a_state,
                'state_reason': a.get('StateReason', ''),
                'last_updated': state_updated_str,
                'instance_id': instance_id,
                'aws_account_id': acc.id,
                'aws_account_name': acc.account_name,
                'aws_account_number': acc.account_id or 'N/A',
                'region': region
            })

    return {'alarms': all_alarms, 'count': len(all_alarms), 'errors': errors}, 200


def delete_ec2_alarm_service(user, alarm_name, requested_account_id=None):
    """Deletes an EC2 CloudWatch alarm via delete_alarms()."""
    if not alarm_name:
        return {'error': 'Alarm Name is required.', 'code': 'InvalidParameterValue'}, 400

    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    if not accounts:
        return {'error': 'No connected AWS accounts found.'}, 400

    deleted_acc = None

    for acc in accounts:
        cw_client, region, target_acc, err, _ = AWSClientManager.get_client(user, 'cloudwatch', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        if err or not cw_client:
            continue

        res, err_call, status_code = AWSClientManager.execute_aws_call(
            cw_client, 'cloudwatch', 'delete_alarms', target_acc, region, 'delete_alarms',
            AlarmNames=[alarm_name]
        )
        if not err_call:
            deleted_acc = target_acc
            break

    if not deleted_acc:
        return {'error': f'Failed to delete alarm "{alarm_name}". Alarm not found or permission denied.'}, 404

    # Remove state track
    AlarmStateTrack.query.filter_by(user_id=user.id, alarm_name=alarm_name).delete()
    db.session.commit()

    create_notification(
        user_id=user.id,
        notif_type='INFO',
        title='CPU Alarm Deleted',
        message=f'Alarm "{alarm_name}" was deleted from {deleted_acc.account_name}.',
        severity='INFO',
        resource_type='CLOUDWATCH',
        aws_account_id=deleted_acc.id
    )

    return {'message': f'Alarm "{alarm_name}" deleted successfully.'}, 200


def check_ec2_health_watch_service(user, requested_account_id=None):
    """Monitors EC2 StatusCheckFailed, StatusCheckFailed_Instance, StatusCheckFailed_System and emits state-change notifications."""
    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    if not accounts:
        return {'health_instances': [], 'total': 0}, 200

    health_records = []
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(minutes=15)

    for acc in accounts:
        ec2_client, region, target_acc, err, _ = AWSClientManager.get_client(user, 'ec2', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        if err or not ec2_client:
            continue

        desc_res, _, _ = AWSClientManager.execute_aws_call(
            ec2_client, 'ec2', 'describe_instances', target_acc, region, 'describe_instances'
        )

        cw_client, _, _, _, _ = AWSClientManager.get_client(user, 'cloudwatch', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        if not desc_res or not cw_client:
            continue

        for r in desc_res.get('Reservations', []):
            for inst in r.get('Instances', []):
                iid = inst.get('InstanceId')
                state_name = inst.get('State', {}).get('Name')
                name_tag = next((t['Value'] for t in inst.get('Tags', []) if t.get('Key') == 'Name'), iid)

                status_fail = 0
                inst_fail = 0
                sys_fail = 0

                # Fetch StatusCheckFailed
                res_sc, _, _ = AWSClientManager.execute_aws_call(
                    cw_client, 'cloudwatch', 'get_metric_statistics', target_acc, region, 'get_metric_statistics',
                    Namespace='AWS/EC2', MetricName='StatusCheckFailed', Dimensions=[{'Name': 'InstanceId', 'Value': iid}],
                    StartTime=start_time, EndTime=now, Period=300, Statistics=['Maximum']
                )
                if res_sc and res_sc.get('Datapoints'):
                    status_fail = max(dp.get('Maximum', 0) for dp in res_sc['Datapoints'])

                # Fetch StatusCheckFailed_Instance
                res_inst, _, _ = AWSClientManager.execute_aws_call(
                    cw_client, 'cloudwatch', 'get_metric_statistics', target_acc, region, 'get_metric_statistics',
                    Namespace='AWS/EC2', MetricName='StatusCheckFailed_Instance', Dimensions=[{'Name': 'InstanceId', 'Value': iid}],
                    StartTime=start_time, EndTime=now, Period=300, Statistics=['Maximum']
                )
                if res_inst and res_inst.get('Datapoints'):
                    inst_fail = max(dp.get('Maximum', 0) for dp in res_inst['Datapoints'])

                # Fetch StatusCheckFailed_System
                res_sys, _, _ = AWSClientManager.execute_aws_call(
                    cw_client, 'cloudwatch', 'get_metric_statistics', target_acc, region, 'get_metric_statistics',
                    Namespace='AWS/EC2', MetricName='StatusCheckFailed_System', Dimensions=[{'Name': 'InstanceId', 'Value': iid}],
                    StartTime=start_time, EndTime=now, Period=300, Statistics=['Maximum']
                )
                if res_sys and res_sys.get('Datapoints'):
                    sys_fail = max(dp.get('Maximum', 0) for dp in res_sys['Datapoints'])

                current_health = 'FAILED' if (status_fail > 0 or inst_fail > 0 or sys_fail > 0) else 'HEALTHY'

                # Track State Transition
                alarm_key = f"HEALTH_{iid}"
                track = AlarmStateTrack.query.filter_by(
                    user_id=user.id,
                    aws_account_id=acc.id,
                    alarm_name=alarm_key,
                    track_type='HEALTH_CHECK'
                ).first()

                if not track:
                    track = AlarmStateTrack(
                        user_id=user.id,
                        aws_account_id=acc.id,
                        alarm_name=alarm_key,
                        resource_id=iid,
                        track_type='HEALTH_CHECK',
                        last_state=current_health
                    )
                    db.session.add(track)
                    db.session.commit()
                elif track.last_state != current_health:
                    old_state = track.last_state
                    track.last_state = current_health
                    db.session.commit()

                    if old_state == 'HEALTHY' and current_health == 'FAILED':
                        create_notification(
                            user_id=user.id,
                            notif_type='WARNING',
                            title='EC2 Instance Health Check Failed',
                            message=f'Instance {name_tag} ({iid}) reported a failed status check in {acc.account_name}.',
                            severity='WARNING',
                            resource_type='CLOUDWATCH',
                            resource_id=iid,
                            aws_account_id=acc.id
                        )
                    elif old_state == 'FAILED' and current_health == 'HEALTHY':
                        create_notification(
                            user_id=user.id,
                            notif_type='SUCCESS',
                            title='EC2 Instance Health Recovered',
                            message=f'Instance {name_tag} ({iid}) status check returned to healthy in {acc.account_name}.',
                            severity='SUCCESS',
                            resource_type='CLOUDWATCH',
                            resource_id=iid,
                            aws_account_id=acc.id
                        )

                health_records.append({
                    'instance_id': iid,
                    'name': name_tag,
                    'instance_state': state_name,
                    'status_check_failed': status_fail,
                    'status_check_instance': inst_fail,
                    'status_check_system': sys_fail,
                    'health_state': current_health,
                    'aws_account_id': acc.id,
                    'aws_account_name': acc.account_name,
                    'aws_account_number': acc.account_id or 'N/A'
                })

    return {'health_instances': health_records, 'total': len(health_records)}, 200


def get_s3_metrics_service(user, bucket_name=None, time_range='1h', requested_account_id=None):
    """Fetches real AWS/S3 CloudWatch metrics (BucketSizeBytes, NumberOfObjects)."""
    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    if not accounts:
        return {'metrics': [], 'has_data': False}, 200

    now = datetime.now(timezone.utc)
    start_time = now - timedelta(days=2) # AWS S3 CloudWatch metrics publish daily

    result_metrics = []
    has_real_data = False

    for acc in accounts:
        cw_client, region, target_acc, err, _ = AWSClientManager.get_client(user, 'cloudwatch', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        s3_client, _, _, _, _ = AWSClientManager.get_client(user, 's3', requested_account_id=acc.id, req_region=DEFAULT_REGION)

        if err or not cw_client or not s3_client:
            continue

        b_res, _, _ = AWSClientManager.execute_aws_call(s3_client, 's3', 'list_buckets', target_acc, region, 'list_buckets')
        if not b_res:
            continue

        target_buckets = [bucket_name] if bucket_name else [b['Name'] for b in b_res.get('Buckets', [])]

        for b_name in target_buckets:
            # 1. BucketSizeBytes
            size_res, _, _ = AWSClientManager.execute_aws_call(
                cw_client, 'cloudwatch', 'get_metric_statistics', target_acc, region, 'get_metric_statistics',
                Namespace='AWS/S3', MetricName='BucketSizeBytes',
                Dimensions=[{'Name': 'BucketName', 'Value': b_name}, {'Name': 'StorageType', 'Value': 'StandardStorage'}],
                StartTime=start_time, EndTime=now, Period=86400, Statistics=['Average']
            )

            # 2. NumberOfObjects
            obj_res, _, _ = AWSClientManager.execute_aws_call(
                cw_client, 'cloudwatch', 'get_metric_statistics', target_acc, region, 'get_metric_statistics',
                Namespace='AWS/S3', MetricName='NumberOfObjects',
                Dimensions=[{'Name': 'BucketName', 'Value': b_name}, {'Name': 'StorageType', 'Value': 'AllStorageTypes'}],
                StartTime=start_time, EndTime=now, Period=86400, Statistics=['Average']
            )

            size_bytes = None
            object_count = None

            if size_res and size_res.get('Datapoints'):
                dps = size_res['Datapoints']
                dps.sort(key=lambda x: x.get('Timestamp'))
                size_bytes = dps[-1].get('Average')
                has_real_data = True

            if obj_res and obj_res.get('Datapoints'):
                dps = obj_res['Datapoints']
                dps.sort(key=lambda x: x.get('Timestamp'))
                object_count = int(dps[-1].get('Average', 0))
                has_real_data = True

            result_metrics.append({
                'bucket_name': b_name,
                'size_bytes': size_bytes,
                'size_gb': round(size_bytes / (1024 ** 3), 4) if size_bytes is not None else None,
                'object_count': object_count,
                'has_data': size_bytes is not None or object_count is not None,
                'aws_account_id': acc.id,
                'aws_account_name': acc.account_name,
                'aws_account_number': acc.account_id or 'N/A'
            })

    return {'metrics': result_metrics, 'has_data': has_real_data}, 200


def get_s3_buckets_service(user, requested_account_id=None):
    """Lists S3 buckets for CloudWatch selection."""
    from services.s3_service import list_buckets_service
    return list_buckets_service(user, requested_account_id=requested_account_id)


def create_s3_watch_service(user, bucket_name, threshold_gb, requested_account_id=None):
    """Saves a storage threshold watch for an S3 bucket."""
    if not bucket_name or not str(bucket_name).strip():
        return {'error': 'Bucket Name is required.', 'code': 'InvalidParameterValue'}, 400

    try:
        t_gb = float(threshold_gb)
        if t_gb <= 0:
            return {'error': 'Threshold must be greater than 0 GB.', 'code': 'InvalidParameterValue'}, 400
    except (ValueError, TypeError):
        return {'error': 'Threshold must be a valid number in GB.', 'code': 'InvalidParameterValue'}, 400

    from services.s3_service import get_s3_client_for_bucket
    _, _, target_acc, err, _ = get_s3_client_for_bucket(user, bucket_name, requested_account_id=requested_account_id)
    if err or not target_acc:
        return err or {'error': f'Bucket "{bucket_name}" not found.'}, 404

    clean_bucket = str(bucket_name).strip().lower()

    watch = S3StorageWatch.query.filter_by(user_id=user.id, aws_account_id=target_acc.id, bucket_name=clean_bucket).first()
    if not watch:
        watch = S3StorageWatch(
            user_id=user.id,
            aws_account_id=target_acc.id,
            bucket_name=clean_bucket,
            threshold_gb=t_gb,
            last_state='OK'
        )
        db.session.add(watch)
    else:
        watch.threshold_gb = t_gb

    db.session.commit()

    create_notification(
        user_id=user.id,
        notif_type='SUCCESS',
        title='S3 Storage Watch Created',
        message=f'Storage threshold of {t_gb} GB set for bucket "{clean_bucket}" in {target_acc.account_name}.',
        severity='SUCCESS',
        resource_type='CLOUDWATCH',
        resource_id=clean_bucket,
        aws_account_id=target_acc.id
    )

    return {
        'message': f'Storage watch for bucket "{clean_bucket}" created successfully.',
        'watch': watch.to_dict()
    }, 201


def list_s3_watches_service(user, requested_account_id=None):
    """Lists configured S3 storage watches."""
    query = S3StorageWatch.query.filter_by(user_id=user.id)
    if requested_account_id and str(requested_account_id).lower() not in ('all', '', 'none'):
        try:
            query = query.filter_by(aws_account_id=int(requested_account_id))
        except (ValueError, TypeError):
            pass

    watches = query.order_by(S3StorageWatch.created_at.desc()).all()
    return {'watches': [w.to_dict() for w in watches], 'count': len(watches)}, 200


def delete_s3_watch_service(user, watch_id):
    """Deletes an S3 storage watch."""
    watch = S3StorageWatch.query.filter_by(id=watch_id, user_id=user.id).first()
    if not watch:
        return {'error': 'S3 Storage Watch not found.'}, 404

    b_name = watch.bucket_name
    db.session.delete(watch)
    db.session.commit()

    return {'message': f'Storage watch for bucket "{b_name}" removed successfully.'}, 200


def check_s3_storage_watches_service(user):
    """Evaluates real S3 storage size against watches and triggers state-change notifications."""
    watches = S3StorageWatch.query.filter_by(user_id=user.id).all()
    if not watches:
        return {'evaluated': 0}, 200

    from services.s3_service import fetch_s3_buckets_for_account

    # Cache account bucket sizes
    acc_buckets_cache = {}

    for watch in watches:
        acc = watch.aws_account
        if not acc:
            continue

        if acc.id not in acc_buckets_cache:
            buckets, _, _, _ = fetch_s3_buckets_for_account(user, acc)
            acc_buckets_cache[acc.id] = {b['name']: b['size_bytes'] for b in buckets}

        bucket_size_bytes = acc_buckets_cache[acc.id].get(watch.bucket_name, 0)
        current_gb = round(bucket_size_bytes / (1024 ** 3), 4)

        current_state = 'EXCEEDED' if current_gb > watch.threshold_gb else 'OK'

        if watch.last_state != current_state:
            old_state = watch.last_state
            watch.last_state = current_state
            db.session.commit()

            if old_state == 'OK' and current_state == 'EXCEEDED':
                create_notification(
                    user_id=user.id,
                    notif_type='WARNING',
                    title='S3 Storage Threshold Exceeded',
                    message=f'Bucket "{watch.bucket_name}" ({current_gb:.2f} GB) exceeded the configured threshold of {watch.threshold_gb} GB in {acc.account_name}.',
                    severity='WARNING',
                    resource_type='S3',
                    resource_id=watch.bucket_name,
                    aws_account_id=acc.id
                )
            elif old_state == 'EXCEEDED' and current_state == 'OK':
                create_notification(
                    user_id=user.id,
                    notif_type='SUCCESS',
                    title='S3 Storage Threshold Recovered',
                    message=f'Bucket "{watch.bucket_name}" storage usage returned below threshold of {watch.threshold_gb} GB in {acc.account_name}.',
                    severity='SUCCESS',
                    resource_type='S3',
                    resource_id=watch.bucket_name,
                    aws_account_id=acc.id
                )

    return {'evaluated': len(watches)}, 200

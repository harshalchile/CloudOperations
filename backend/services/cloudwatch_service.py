import boto3
from datetime import datetime, timedelta, timezone
from botocore.exceptions import BotoCoreError, ClientError
from services.aws_service import get_target_aws_accounts
from utils.aws_audit import log_aws_call, extract_client_error, verify_sts_identity

def get_cloudwatch_client_for_account(acc):
    """Instantiates a boto3 CloudWatch client for a given AWSAccount instance after verifying STS caller identity."""
    identity, sts_err, status_code = verify_sts_identity(acc)
    if sts_err:
        return None, acc.region, sts_err.get('error')

    try:
        client = boto3.client(
            'cloudwatch',
            aws_access_key_id=acc.get_decrypted_access_key(),
            aws_secret_access_key=acc.get_decrypted_secret_key(),
            region_name=acc.region or 'us-east-1'
        )
        return client, acc.region, None
    except Exception as e:
        return None, acc.region, str(e)


def get_logs_client_for_account(acc):
    """Instantiates a boto3 CloudWatch Logs client for a given AWSAccount instance after verifying STS caller identity."""
    identity, sts_err, status_code = verify_sts_identity(acc)
    if sts_err:
        return None, acc.region, sts_err.get('error')

    try:
        client = boto3.client(
            'logs',
            aws_access_key_id=acc.get_decrypted_access_key(),
            aws_secret_access_key=acc.get_decrypted_secret_key(),
            region_name=acc.region or 'us-east-1'
        )
        return client, acc.region, None
    except Exception as e:
        return None, acc.region, str(e)


def get_cloudwatch_dashboard_stats_service(user):
    """
    Returns CloudWatch summary statistics across target AWS accounts:
    - Total Alarms
    - Alarms in ALARM state
    - Alarms in OK state
    - Number of Log Groups
    - Total Metrics
    - Last AWS API Sync Time
    """
    accounts = get_target_aws_accounts(user)
    now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')

    if not accounts:
        return {
            'total_alarms': 0,
            'alarms_in_alarm': 0,
            'alarms_in_ok': 0,
            'alarms_insufficient_data': 0,
            'total_log_groups': 0,
            'total_metrics': 0,
            'last_sync_time': now_iso,
            'accounts_count': 0
        }, 200

    total_alarms = 0
    alarms_in_alarm = 0
    alarms_in_ok = 0
    alarms_insufficient = 0
    total_log_groups = 0
    total_metrics = 0
    errors = []

    for acc in accounts:
        cw_client, region, err = get_cloudwatch_client_for_account(acc)
        if cw_client:
            try:
                res_a = cw_client.describe_alarms()
                alarms = res_a.get('MetricAlarms', [])
                total_alarms += len(alarms)
                for a in alarms:
                    state = a.get('StateValue')
                    if state == 'ALARM':
                        alarms_in_alarm += 1
                    elif state == 'OK':
                        alarms_in_ok += 1
                    else:
                        alarms_insufficient += 1
            except Exception as e:
                errors.append(f"Alarms error ({acc.account_name}): {str(e)}")

            try:
                res_m = cw_client.list_metrics()
                total_metrics += len(res_m.get('Metrics', []))
            except Exception as e:
                errors.append(f"Metrics error ({acc.account_name}): {str(e)}")

        logs_client, region, err_l = get_logs_client_for_account(acc)
        if logs_client:
            try:
                res_l = logs_client.describe_log_groups()
                total_log_groups += len(res_l.get('logGroups', []))
            except Exception as e:
                errors.append(f"Log Groups error ({acc.account_name}): {str(e)}")

    return {
        'total_alarms': total_alarms,
        'alarms_in_alarm': alarms_in_alarm,
        'alarms_in_ok': alarms_in_ok,
        'alarms_insufficient_data': alarms_insufficient,
        'total_log_groups': total_log_groups,
        'total_metrics': total_metrics,
        'last_sync_time': now_iso,
        'accounts_count': len(accounts),
        'errors': errors
    }, 200


def list_alarms_service(user, state_filter=None):
    """Lists all CloudWatch Metric Alarms with optional state filtering (ALARM, OK, INSUFFICIENT_DATA)."""
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'alarms': [], 'count': 0, 'message': 'No AWS accounts connected.'}, 200

    all_alarms = []
    errors = []

    for acc in accounts:
        cw_client, region, err = get_cloudwatch_client_for_account(acc)
        if err:
            errors.append(f"Account '{acc.account_name}': {err}")
            continue

        try:
            kwargs = {}
            if state_filter and state_filter.upper() in ['ALARM', 'OK', 'INSUFFICIENT_DATA']:
                kwargs['StateValue'] = state_filter.upper()

            res = cw_client.describe_alarms(**kwargs)
            for a in res.get('MetricAlarms', []):
                state_updated = a.get('StateUpdatedTimestamp')
                if isinstance(state_updated, datetime):
                    state_updated_str = state_updated.strftime('%Y-%m-%d %H:%M:%S UTC')
                else:
                    state_updated_str = str(state_updated) if state_updated else 'N/A'

                dimensions = [{'name': d.get('Name'), 'value': d.get('Value')} for d in a.get('Dimensions', [])]

                all_alarms.append({
                    'alarm_name': a.get('AlarmName'),
                    'alarm_arn': a.get('AlarmArn'),
                    'description': a.get('AlarmDescription', 'No description provided.'),
                    'namespace': a.get('Namespace', 'AWS/EC2'),
                    'metric_name': a.get('MetricName', 'N/A'),
                    'statistic': a.get('Statistic', a.get('ExtendedStatistic', 'Average')),
                    'threshold': a.get('Threshold'),
                    'comparison_operator': a.get('ComparisonOperator', 'GreaterThanOrEqualToThreshold'),
                    'evaluation_periods': a.get('EvaluationPeriods', 1),
                    'period': a.get('Period', 300),
                    'state_value': a.get('StateValue', 'INSUFFICIENT_DATA'),
                    'state_reason': a.get('StateReason', ''),
                    'state_reason_data': a.get('StateReasonData', ''),
                    'last_updated': state_updated_str,
                    'dimensions': dimensions,
                    'unit': a.get('Unit', 'N/A'),
                    'aws_account_id': acc.id,
                    'aws_account_name': acc.account_name,
                    'region': region
                })
        except Exception as e:
            errors.append(f"Account '{acc.account_name}': {str(e)}")

    return {'alarms': all_alarms, 'count': len(all_alarms), 'errors': errors}, 200


def get_alarm_details_service(user, alarm_name):
    """Gets detailed info and state history for a specific CloudWatch Alarm."""
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'error': 'No AWS accounts connected.'}, 404

    for acc in accounts:
        cw_client, region, err = get_cloudwatch_client_for_account(acc)
        if err or not cw_client:
            continue

        try:
            res = cw_client.describe_alarms(AlarmNames=[alarm_name])
            alarms = res.get('MetricAlarms', [])
            if alarms:
                a = alarms[0]
                state_updated = a.get('StateUpdatedTimestamp')
                state_updated_str = state_updated.strftime('%Y-%m-%d %H:%M:%S UTC') if isinstance(state_updated, datetime) else str(state_updated or 'N/A')

                # Fetch Alarm History
                history_items = []
                try:
                    h_res = cw_client.describe_alarm_history(AlarmName=alarm_name, HistoryItemType='StateUpdate', MaxRecords=15)
                    for item in h_res.get('AlarmHistoryItems', []):
                        ts = item.get('Timestamp')
                        ts_str = ts.strftime('%Y-%m-%d %H:%M:%S UTC') if isinstance(ts, datetime) else str(ts or '')
                        history_items.append({
                            'timestamp': ts_str,
                            'history_summary': item.get('HistorySummary'),
                            'history_data': item.get('HistoryData'),
                            'type': item.get('HistoryItemType')
                        })
                except Exception:
                    pass

                dimensions = [{'name': d.get('Name'), 'value': d.get('Value')} for d in a.get('Dimensions', [])]

                return {
                    'alarm': {
                        'alarm_name': a.get('AlarmName'),
                        'alarm_arn': a.get('AlarmArn'),
                        'description': a.get('AlarmDescription', 'No description provided.'),
                        'namespace': a.get('Namespace'),
                        'metric_name': a.get('MetricName'),
                        'statistic': a.get('Statistic', a.get('ExtendedStatistic', 'Average')),
                        'threshold': a.get('Threshold'),
                        'comparison_operator': a.get('ComparisonOperator'),
                        'evaluation_periods': a.get('EvaluationPeriods'),
                        'datapoints_to_evaluate': a.get('DatapointsToEvaluate', a.get('EvaluationPeriods')),
                        'period': a.get('Period'),
                        'state_value': a.get('StateValue'),
                        'state_reason': a.get('StateReason'),
                        'state_reason_data': a.get('StateReasonData'),
                        'last_updated': state_updated_str,
                        'dimensions': dimensions,
                        'unit': a.get('Unit', 'Count'),
                        'actions_enabled': a.get('ActionsEnabled', True),
                        'alarm_actions': a.get('AlarmActions', []),
                        'ok_actions': a.get('OKActions', []),
                        'aws_account_name': acc.account_name,
                        'region': region
                    },
                    'history': history_items
                }, 200
        except Exception as e:
            continue

    return {'error': f'Alarm "{alarm_name}" not found.'}, 404


def list_log_groups_service(user):
    """Lists CloudWatch Log Groups using logs.describe_log_groups."""
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'log_groups': [], 'count': 0, 'message': 'No AWS accounts connected.'}, 200

    all_groups = []
    errors = []

    for acc in accounts:
        logs_client, region, err = get_logs_client_for_account(acc)
        if err or not logs_client:
            errors.append(f"Account '{acc.account_name}': {err}")
            continue

        try:
            res = logs_client.describe_log_groups()
            for g in res.get('logGroups', []):
                created_ms = g.get('creationTime')
                created_str = datetime.fromtimestamp(created_ms / 1000.0, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC') if created_ms else 'N/A'

                all_groups.append({
                    'log_group_name': g.get('logGroupName'),
                    'arn': g.get('arn'),
                    'stored_bytes': g.get('storedBytes', 0),
                    'retention_in_days': g.get('retentionInDays', 'Never Expire'),
                    'creation_time': created_str,
                    'metric_filter_count': g.get('metricFilterCount', 0),
                    'aws_account_id': acc.id,
                    'aws_account_name': acc.account_name,
                    'region': region
                })
        except Exception as e:
            errors.append(f"Account '{acc.account_name}': {str(e)}")

    return {'log_groups': all_groups, 'count': len(all_groups), 'errors': errors}, 200


def list_log_streams_service(user, log_group_name):
    """Lists Log Streams for a given Log Group using logs.describe_log_streams."""
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'log_streams': [], 'count': 0, 'message': 'No AWS accounts connected.'}, 200

    all_streams = []
    errors = []

    for acc in accounts:
        logs_client, region, err = get_logs_client_for_account(acc)
        if err or not logs_client:
            continue

        try:
            res = logs_client.describe_log_streams(
                logGroupName=log_group_name,
                orderBy='LastEventTime',
                descending=True,
                limit=50
            )
            for s in res.get('logStreams', []):
                c_time = s.get('creationTime')
                l_event = s.get('lastEventTimestamp') or s.get('lastIngestionTime')

                c_str = datetime.fromtimestamp(c_time / 1000.0, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC') if c_time else 'N/A'
                l_str = datetime.fromtimestamp(l_event / 1000.0, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC') if l_event else 'N/A'

                all_streams.append({
                    'log_stream_name': s.get('logStreamName'),
                    'creation_time': c_str,
                    'last_event_timestamp': l_str,
                    'stored_bytes': s.get('storedBytes', 0),
                    'arn': s.get('arn'),
                    'aws_account_name': acc.account_name,
                    'region': region
                })
            if all_streams:
                break
        except ClientError as e:
            if e.response.get('Error', {}).get('Code') == 'ResourceNotFoundException':
                continue
            errors.append(f"Account '{acc.account_name}': {str(e)}")
        except Exception as e:
            errors.append(f"Account '{acc.account_name}': {str(e)}")

    return {'log_streams': all_streams, 'count': len(all_streams), 'log_group_name': log_group_name, 'errors': errors}, 200


def get_log_events_service(user, log_group_name, log_stream_name, limit=100):
    """Fetches log events for a specific log stream using logs.get_log_events."""
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'events': [], 'count': 0, 'message': 'No AWS accounts connected.'}, 200

    events_list = []
    errors = []

    for acc in accounts:
        logs_client, region, err = get_logs_client_for_account(acc)
        if err or not logs_client:
            continue

        try:
            res = logs_client.get_log_events(
                logGroupName=log_group_name,
                logStreamName=log_stream_name,
                limit=min(int(limit), 200),
                startFromHead=False
            )

            raw_events = res.get('events', [])
            # Sort newest events first as requested
            raw_events.sort(key=lambda x: x.get('timestamp', 0), reverse=True)

            for ev in raw_events:
                ts = ev.get('timestamp')
                ts_str = datetime.fromtimestamp(ts / 1000.0, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC') if ts else 'N/A'
                time_only = datetime.fromtimestamp(ts / 1000.0, timezone.utc).strftime('%H:%M:%S') if ts else ''

                msg = ev.get('message', '')
                # Determine log level if possible
                level = 'INFO'
                msg_upper = msg.upper()
                if 'ERROR' in msg_upper or 'FATAL' in msg_upper or 'EXCEPTION' in msg_upper or 'FAIL' in msg_upper:
                    level = 'ERROR'
                elif 'WARN' in msg_upper or 'WARNING' in msg_upper:
                    level = 'WARN'
                elif 'DEBUG' in msg_upper:
                    level = 'DEBUG'

                events_list.append({
                    'timestamp': ts_str,
                    'time_only': time_only,
                    'message': msg,
                    'level': level,
                    'ingestion_time': ev.get('ingestionTime')
                })

            if events_list or len(raw_events) == 0:
                return {
                    'events': events_list,
                    'count': len(events_list),
                    'log_group_name': log_group_name,
                    'log_stream_name': log_stream_name,
                    'next_forward_token': res.get('nextForwardToken'),
                    'next_backward_token': res.get('nextBackwardToken')
                }, 200
        except ClientError as e:
            code = e.response.get('Error', {}).get('Code')
            if code == 'ResourceNotFoundException':
                continue
            errors.append(f"Logs error ({acc.account_name}): {str(e)}")
        except Exception as e:
            errors.append(f"Logs error ({acc.account_name}): {str(e)}")

    return {'events': [], 'count': 0, 'errors': errors, 'log_group_name': log_group_name, 'log_stream_name': log_stream_name}, 200


def list_metrics_service(user, namespace=None):
    """Lists available metrics in CloudWatch using cloudwatch.list_metrics."""
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'metrics': [], 'count': 0}, 200

    all_metrics = []

    for acc in accounts:
        cw_client, region, err = get_cloudwatch_client_for_account(acc)
        if err or not cw_client:
            continue

        try:
            kwargs = {}
            if namespace:
                kwargs['Namespace'] = namespace

            res = cw_client.list_metrics(**kwargs)
            for m in res.get('Metrics', []):
                dims = [{'name': d.get('Name'), 'value': d.get('Value')} for d in m.get('Dimensions', [])]
                all_metrics.append({
                    'namespace': m.get('Namespace'),
                    'metric_name': m.get('MetricName'),
                    'dimensions': dims,
                    'aws_account_name': acc.account_name,
                    'region': region
                })
        except Exception:
            pass

    return {'metrics': all_metrics, 'count': len(all_metrics)}, 200


def get_ec2_resources_service(user):
    """Helper service to fetch connected EC2 instances list for CloudWatch metrics filter."""
    accounts = get_target_aws_accounts(user)
    instances = []

    for acc in accounts:
        try:
            ec2_client = boto3.client(
                'ec2',
                aws_access_key_id=acc.get_decrypted_access_key(),
                aws_secret_access_key=acc.get_decrypted_secret_key(),
                region_name=acc.region or 'us-east-1'
            )
            res = ec2_client.describe_instances()
            for r in res.get('Reservations', []):
                for inst in r.get('Instances', []):
                    inst_id = inst.get('InstanceId')
                    name = inst_id
                    for tag in inst.get('Tags', []):
                        if tag.get('Key') == 'Name':
                            name = f"{tag.get('Value')} ({inst_id})"
                            break
                    instances.append({
                        'instance_id': inst_id,
                        'name': name,
                        'account_name': acc.account_name
                    })
        except Exception:
            pass

    return {'instances': instances}, 200


def get_metric_statistics_service(user, namespace, metric_name, time_range='1h', dimension_name=None, dimension_value=None, stat='Average'):
    """
    Fetches metric statistics using cloudwatch.get_metric_statistics for the given time range and dimension.
    Supported time_range values: '1h', '6h', '24h', '7d'.
    """
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'datapoints': [], 'count': 0, 'metric_name': metric_name, 'namespace': namespace}, 200

    now = datetime.now(timezone.utc)

    if time_range == '1h':
        start_time = now - timedelta(hours=1)
        period = 60 # 1 min datapoints
    elif time_range == '6h':
        start_time = now - timedelta(hours=6)
        period = 300 # 5 min datapoints
    elif time_range == '24h':
        start_time = now - timedelta(hours=24)
        period = 900 # 15 min datapoints
    elif time_range == '7d':
        start_time = now - timedelta(days=7)
        period = 3600 # 1 hour datapoints
    else:
        start_time = now - timedelta(hours=1)
        period = 60

    unit_map = {
        'CPUUtilization': 'Percent',
        'NetworkIn': 'Bytes',
        'NetworkOut': 'Bytes',
        'DiskReadBytes': 'Bytes',
        'DiskWriteBytes': 'Bytes',
        'StatusCheckFailed': 'Count'
    }
    expected_unit = unit_map.get(metric_name)

    stats_requested = ['Average', 'Sum', 'Maximum', 'Minimum']

    aggregated_datapoints = {}

    for acc in accounts:
        cw_client, region, err = get_cloudwatch_client_for_account(acc)
        if err or not cw_client:
            continue

        try:
            dimensions = []
            if dimension_name and dimension_value:
                dimensions.append({'Name': dimension_name, 'Value': dimension_value})

            kwargs = {
                'Namespace': namespace or 'AWS/EC2',
                'MetricName': metric_name,
                'StartTime': start_time,
                'EndTime': now,
                'Period': period,
                'Statistics': stats_requested
            }
            if dimensions:
                kwargs['Dimensions'] = dimensions
            if expected_unit:
                kwargs['Unit'] = expected_unit

            res = cw_client.get_metric_statistics(**kwargs)
            dps = res.get('Datapoints', [])

            for dp in dps:
                ts = dp.get('Timestamp')
                if not ts:
                    continue

                ts_key = ts.strftime('%Y-%m-%d %H:%M')
                if time_range in ['1h', '6h']:
                    label = ts.strftime('%H:%M')
                else:
                    label = ts.strftime('%m-%d %H:%M')

                val = dp.get(stat)
                if val is None:
                    val = dp.get('Average') if 'Average' in dp else (dp.get('Sum', 0))

                if ts_key not in aggregated_datapoints:
                    aggregated_datapoints[ts_key] = {
                        'timestamp': ts_key,
                        'label': label,
                        'value': round(val, 2) if val is not None else 0,
                        'unit': dp.get('Unit', expected_unit or 'Count'),
                        'count': 1
                    }
                else:
                    existing = aggregated_datapoints[ts_key]
                    existing['value'] = round((existing['value'] * existing['count'] + val) / (existing['count'] + 1), 2)
                    existing['count'] += 1

        except Exception as e:
            print(f"[CW METRICS WARNING] Error fetching {metric_name} for {acc.account_name}: {e}")

    sorted_dps = sorted(aggregated_datapoints.values(), key=lambda x: x['timestamp'])

    return {
        'metric_name': metric_name,
        'namespace': namespace,
        'time_range': time_range,
        'period': period,
        'stat': stat,
        'unit': expected_unit or (sorted_dps[0]['unit'] if sorted_dps else ''),
        'datapoints': sorted_dps,
        'count': len(sorted_dps)
    }, 200

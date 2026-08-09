import os
import io
import time
import re
import logging
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
import boto3
from flask import send_file
from boto3.s3.transfer import TransferConfig
from botocore.exceptions import ClientError
from services.aws_service import get_target_aws_accounts
from utils.aws_client_manager import AWSClientManager

logger = logging.getLogger("s3_service")

DEFAULT_REGION = os.getenv('AWS_REGION', 'ap-south-1')
DEFAULT_PRESIGNED_EXPIRATION = int(os.getenv('S3_PRESIGNED_URL_EXPIRATION', 3600))
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024  # 5 GB


def format_size(size_in_bytes):
    if size_in_bytes is None:
        return '0 B'
    if size_in_bytes < 1024:
        return f"{size_in_bytes} B"
    elif size_in_bytes < 1024 * 1024:
        return f"{size_in_bytes / 1024:.1f} KB"
    elif size_in_bytes < 1024 * 1024 * 1024:
        return f"{size_in_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_in_bytes / (1024 * 1024 * 1024):.2f} GB"


def validate_s3_bucket_name(bucket_name):
    """Validates S3 bucket naming rules according to AWS specifications."""
    if not bucket_name or len(bucket_name) < 3 or len(bucket_name) > 63:
        return False, "Bucket name must be between 3 and 63 characters long."
    if not re.match(r'^[a-z0-9][a-z0-9.-]*[a-z0-9]$', bucket_name):
        return False, "Bucket name must start and end with a lowercase letter or number, and contain only lowercase letters, numbers, hyphens, and dots."
    if '..' in bucket_name or '.-' in bucket_name or '-.' in bucket_name:
        return False, "Bucket name cannot contain adjacent dots or hyphens."
    if re.match(r'^\d+\.\d+\.\d+\.\d+$', bucket_name):
        return False, "Bucket name cannot be formatted as an IP address."
    return True, None


def get_s3_client_for_bucket(user, bucket_name, requested_account_id=None):
    """Locates the AWS account containing bucket_name and returns an initialized S3 boto3 client in ap-south-1."""
    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    for acc in accounts:
        s3_client, region, target_acc, err, _ = AWSClientManager.get_client(user, 's3', requested_account_id=acc.id, req_region=DEFAULT_REGION)
        if err or not s3_client:
            continue
        res, _, _ = AWSClientManager.execute_aws_call(
            s3_client, 's3', 'head_bucket', target_acc, region, 'head_bucket',
            Bucket=bucket_name
        )
        if res is not None:
            return s3_client, region, target_acc, None, 200

    # Fallback to default target user client
    s3_client, region, target_acc, err, sc = AWSClientManager.get_client(user, 's3', requested_account_id=requested_account_id, req_region=DEFAULT_REGION)
    if err or not s3_client:
        return None, region, target_acc, err, sc

    return s3_client, region, target_acc, None, 200


def fetch_s3_buckets_for_account(user, acc):
    s3_client, user_region, target_acc, err, _ = AWSClientManager.get_client(
        user, 's3', requested_account_id=acc.id, req_region=DEFAULT_REGION
    )
    if err or not s3_client:
        return [], 0, 0, f"Account '{acc.account_name}': {err.get('error') if isinstance(err, dict) else err}"

    res, err_call, _ = AWSClientManager.execute_aws_call(
        s3_client, 's3', 'list_buckets', target_acc, user_region, 'list_buckets'
    )
    if err_call or not res:
        return [], 0, 0, f"Account '{acc.account_name}': {err_call.get('error') if isinstance(err_call, dict) else err_call}"

    acc_buckets = []
    acc_storage_bytes = 0
    acc_object_count = 0

    for b in res.get('Buckets', []):
        bucket_name = b['Name']
        creation_date = b['CreationDate'].strftime('%Y-%m-%d %H:%M:%S') if b.get('CreationDate') else 'N/A'

        obj_count = 0
        storage_bytes = 0
        objs_res, _, _ = AWSClientManager.execute_aws_call(
            s3_client, 's3', 'list_objects_v2', target_acc, user_region, 'list_objects_v2',
            Bucket=bucket_name, MaxKeys=1000
        )
        if objs_res:
            contents = objs_res.get('Contents', [])
            obj_count = len(contents)
            storage_bytes = sum(item.get('Size', 0) for item in contents)
            if objs_res.get('IsTruncated'):
                obj_count = objs_res.get('KeyCount', 1000)

        acc_storage_bytes += storage_bytes
        acc_object_count += obj_count

        acc_buckets.append({
            'name': bucket_name,
            'region': DEFAULT_REGION,
            'created': creation_date,
            'objects_count': obj_count,
            'size_bytes': storage_bytes,
            'size_formatted': format_size(storage_bytes),
            'aws_account_id': acc.id,
            'aws_account_name': acc.account_name,
            'aws_account_num': acc.account_id or 'N/A'
        })

    return acc_buckets, acc_storage_bytes, acc_object_count, None


def list_buckets_service(user, requested_account_id=None):
    """
    Lists S3 buckets concurrently across all requested user AWS accounts in ap-south-1.
    Attaches account labels for multi-account display.
    """
    accounts = get_target_aws_accounts(user, requested_account_id=requested_account_id)
    if not accounts:
        return {'buckets': [], 'count': 0, 'total_storage_formatted': '0 B', 'total_objects': 0}, 200

    combined_buckets = []
    total_storage_bytes = 0
    total_object_count = 0

    from flask import current_app
    app_obj = current_app._get_current_object()

    def fetch_with_context(acc_target):
        with app_obj.app_context():
            return fetch_s3_buckets_for_account(user, acc_target)

    with ThreadPoolExecutor(max_workers=min(len(accounts), 10)) as executor:
        future_to_acc = {executor.submit(fetch_with_context, acc): acc for acc in accounts}
        for future in as_completed(future_to_acc):
            acc = future_to_acc[future]
            try:
                acc_buckets, acc_bytes, acc_objs, err_msg = future.result()
                combined_buckets.extend(acc_buckets)
                total_storage_bytes += acc_bytes
                total_object_count += acc_objs
            except Exception as e:
                logger.error(f"[MULTI-ACCOUNT-S3-ERROR] Account {acc.account_name}: {e}")

    return {
        'buckets': combined_buckets,
        'count': len(combined_buckets),
        'total_storage_formatted': format_size(total_storage_bytes),
        'total_objects': total_object_count
    }, 200


def create_bucket_service(user, bucket_name, req_region=None, requested_account_id=None):
    """Creates a new S3 bucket in ap-south-1 using AWSClientManager with real AWS error reporting."""
    if not bucket_name or not str(bucket_name).strip():
        return {'error': 'Bucket name is required.', 'code': 'InvalidBucketName'}, 400

    clean_name = str(bucket_name).strip().lower()

    # S3 Naming Rule Validation
    is_valid, val_err = validate_s3_bucket_name(clean_name)
    if not is_valid:
        return {'error': val_err, 'code': 'InvalidBucketName'}, 400

    s3_client, region, target_acc, err, status_code = AWSClientManager.get_client(
        user, 's3', requested_account_id=requested_account_id, req_region=DEFAULT_REGION
    )
    if err or not s3_client:
        return err, status_code

    create_kwargs = {
        'Bucket': clean_name,
        'CreateBucketConfiguration': {'LocationConstraint': DEFAULT_REGION}
    }

    logger.info(f"[CREATE-BUCKET] Request: Bucket={clean_name} | Region={DEFAULT_REGION} | Account={target_acc.account_name}")

    from services.notification_service import create_notification
    res, err_call, sc = AWSClientManager.execute_aws_call(
        s3_client, 's3', 'create_bucket', target_acc, region, 'create_bucket',
        **create_kwargs
    )
    if err_call:
        err_msg = err_call.get('aws_error_message') or err_call.get('error')
        create_notification(user.id, 'ERROR', 'S3 Operation Failed', f'Unable to create bucket {clean_name}: {err_msg}', severity='ERROR', resource_type='S3', resource_id=clean_name, aws_account_id=target_acc.id)
        return err_call, sc

    create_notification(user.id, 'SUCCESS', 'Bucket Created', f'Bucket {clean_name} was created successfully in {target_acc.account_name}.', severity='SUCCESS', resource_type='S3', resource_id=clean_name, aws_account_id=target_acc.id)
    return {
        'message': f'✅ S3 Bucket "{clean_name}" created successfully in account "{target_acc.account_name}".',
        'bucket_name': clean_name,
        'region': DEFAULT_REGION,
        'aws_account_name': target_acc.account_name
    }, 201


def delete_bucket_service(user, bucket_name, requested_account_id=None):
    """Deletes an empty S3 bucket in ap-south-1."""
    if not bucket_name:
        return {'error': 'Bucket name is required.', 'code': 'InvalidParameterValue'}, 400

    s3_client, region, target_acc, err, sc = get_s3_client_for_bucket(
        user, bucket_name, requested_account_id=requested_account_id
    )
    if err or not s3_client:
        return err, sc

    from services.notification_service import create_notification
    res, err_call, status_code = AWSClientManager.execute_aws_call(
        s3_client, 's3', 'delete_bucket', target_acc, region, 'delete_bucket',
        Bucket=bucket_name
    )
    if err_call:
        err_msg = err_call.get('aws_error_message') or err_call.get('error')
        create_notification(user.id, 'ERROR', 'S3 Operation Failed', f'Unable to delete bucket {bucket_name}: {err_msg}', severity='ERROR', resource_type='S3', resource_id=bucket_name, aws_account_id=target_acc.id if target_acc else None)
        return err_call, status_code

    create_notification(user.id, 'SUCCESS', 'Bucket Deleted', f'Bucket {bucket_name} was deleted successfully.', severity='SUCCESS', resource_type='S3', resource_id=bucket_name, aws_account_id=target_acc.id if target_acc else None)
    return {'message': f'✅ S3 Bucket "{bucket_name}" deleted successfully.'}, 200


def list_objects_service(user, bucket_name, prefix='', requested_account_id=None):
    """Lists objects and folders in a bucket for a given prefix in ap-south-1."""
    if not bucket_name:
        return {'error': 'Bucket name is required.', 'code': 'InvalidParameterValue'}, 400

    s3_client, region, target_acc, err, sc = get_s3_client_for_bucket(
        user, bucket_name, requested_account_id=requested_account_id
    )
    if err or not s3_client:
        return err, sc

    if prefix and not prefix.endswith('/'):
        prefix = prefix + '/'

    kwargs = {'Bucket': bucket_name, 'Delimiter': '/'}
    if prefix:
        kwargs['Prefix'] = prefix

    res, err_call, status_code = AWSClientManager.execute_aws_call(
        s3_client, 's3', 'list_objects_v2', target_acc, region, 'list_objects_v2',
        **kwargs
    )
    if err_call:
        return err_call, status_code

    raw_folders = res.get('CommonPrefixes', [])
    folders_list = []
    for cp in raw_folders:
        folder_prefix = cp.get('Prefix', '')
        folder_name = folder_prefix[len(prefix):].rstrip('/')
        if folder_name:
            folders_list.append({
                'is_folder': True,
                'key': folder_prefix,
                'name': folder_name,
                'prefix': folder_prefix,
                'size_bytes': 0,
                'size_formatted': '--',
                'last_modified': '--',
                'storage_class': 'FOLDER'
            })

    raw_objects = res.get('Contents', [])
    files_list = []
    total_size_bytes = 0

    for obj in raw_objects:
        key = obj.get('Key', '')
        if key == prefix or (key.endswith('/') and obj.get('Size', 0) == 0):
            continue

        size = obj.get('Size', 0)
        total_size_bytes += size
        last_mod = obj['LastModified'].strftime('%Y-%m-%d %H:%M:%S') if obj.get('LastModified') else 'N/A'
        file_name = key[len(prefix):] if prefix and key.startswith(prefix) else key.split('/')[-1] or key

        files_list.append({
            'is_folder': False,
            'key': key,
            'name': file_name,
            'size_bytes': size,
            'size_formatted': format_size(size),
            'last_modified': last_mod,
            'storage_class': obj.get('StorageClass', 'STANDARD'),
            'etag': obj.get('ETag', '').strip('"')
        })

    return {
        'bucket_name': bucket_name,
        'prefix': prefix,
        'folders': folders_list,
        'objects': files_list,
        'count': len(folders_list) + len(files_list),
        'total_size_bytes': total_size_bytes,
        'total_size_formatted': format_size(total_size_bytes),
        'aws_account_name': target_acc.account_name if target_acc else 'AWS',
        'region': DEFAULT_REGION
    }, 200


def create_folder_service(user, bucket_name, folder_path, requested_account_id=None):
    """Creates a zero-byte virtual folder object in S3 ending with '/'."""
    if not bucket_name or not folder_path:
        return {'error': 'bucket_name and folder_path are required.', 'code': 'InvalidParameterValue'}, 400

    folder_path = folder_path.strip()
    if not folder_path.endswith('/'):
        folder_path = folder_path + '/'

    s3_client, region, target_acc, err, sc = get_s3_client_for_bucket(
        user, bucket_name, requested_account_id=requested_account_id
    )
    if err or not s3_client:
        return err, sc

    res, err_call, status_code = AWSClientManager.execute_aws_call(
        s3_client, 's3', 'put_object', target_acc, region, 'put_object',
        Bucket=bucket_name, Key=folder_path, Body=b''
    )
    if err_call:
        return err_call, status_code

    return {'message': f'Folder "{folder_path}" created successfully.', 'folder_key': folder_path}, 201


def upload_object_service(user, bucket_name, file_obj, filename, prefix='', requested_account_id=None):
    """
    Uploads a file to S3 in ap-south-1.
    Uses boto3 TransferConfig for automatic multipart upload for files up to 5 GB.
    """
    if not bucket_name or not file_obj or not filename:
        return {'error': 'Bucket name, file, and filename are required.', 'code': 'InvalidParameterValue'}, 400

    file_obj.seek(0, 2)
    file_size = file_obj.tell()
    file_obj.seek(0)

    if file_size > MAX_FILE_SIZE_BYTES:
        return {'error': 'File exceeds maximum single upload limit of 5 GB.', 'code': 'EntityTooLarge'}, 400

    s3_client, region, target_acc, err, sc = get_s3_client_for_bucket(
        user, bucket_name, requested_account_id=requested_account_id
    )
    if err or not s3_client:
        return err, sc

    if prefix and not prefix.endswith('/'):
        prefix = prefix + '/'

    object_key = f"{prefix}{filename}" if prefix else filename

    import mimetypes
    guessed_type, _ = mimetypes.guess_type(filename)
    content_type = guessed_type or getattr(file_obj, 'content_type', None) or 'application/octet-stream'

    # Multipart Upload TransferConfig (Multipart enabled for files > 8 MB)
    transfer_config = TransferConfig(
        multipart_threshold=8 * 1024 * 1024,
        max_concurrency=10,
        multipart_chunksize=8 * 1024 * 1024,
        use_threads=True
    )

    logger.info(
        f"[UPLOAD-START] Bucket: {bucket_name} | Key: {object_key} | Size: {format_size(file_size)} | "
        f"ContentType: {content_type} | Account: {target_acc.account_name}"
    )

    from services.notification_service import create_notification
    res, err_call, status_code = AWSClientManager.execute_aws_call(
        s3_client, 's3', 'upload_fileobj', target_acc, region, 'upload_fileobj',
        Fileobj=file_obj, Bucket=bucket_name, Key=object_key,
        ExtraArgs={'ContentType': content_type},
        Config=transfer_config
    )
    if err_call:
        err_msg = err_call.get('aws_error_message') or err_call.get('error')
        create_notification(user.id, 'ERROR', 'S3 Operation Failed', f'Failed to upload {filename} to {bucket_name}: {err_msg}', severity='ERROR', resource_type='S3', resource_id=object_key, aws_account_id=target_acc.id if target_acc else None)
        return err_call, status_code

    logger.info(f"[UPLOAD-SUCCESS] Bucket: {bucket_name} | Key: {object_key}")
    create_notification(user.id, 'SUCCESS', 'File Uploaded', f'{filename} uploaded to bucket {bucket_name}.', severity='SUCCESS', resource_type='S3', resource_id=object_key, aws_account_id=target_acc.id if target_acc else None)

    return {
        'message': f'✅ File "{filename}" uploaded successfully to "{bucket_name}".',
        'object_key': object_key,
        'bucket_name': bucket_name,
        'size_bytes': file_size,
        'size_formatted': format_size(file_size),
        'content_type': content_type
    }, 200


def get_presigned_url_service(user, bucket_name, object_key, expires_in=None, requested_account_id=None):
    """Generates a secure AWS S3 pre-signed URL for direct download or preview along with standard S3 public URL format."""
    if not bucket_name or not object_key:
        return {'error': 'bucket_name and object_key are required.', 'code': 'InvalidParameterValue'}, 400

    if not expires_in or int(expires_in) <= 0:
        expires_in = DEFAULT_PRESIGNED_EXPIRATION
    else:
        expires_in = int(expires_in)

    s3_client, region, target_acc, err, sc = get_s3_client_for_bucket(
        user, bucket_name, requested_account_id=requested_account_id
    )
    if err or not s3_client:
        return err, sc

    res, err_call, status_code = AWSClientManager.execute_aws_call(
        s3_client, 's3', 'generate_presigned_url', target_acc, region, 'generate_presigned_url',
        ClientMethod='get_object', Params={'Bucket': bucket_name, 'Key': object_key}, ExpiresIn=expires_in
    )
    if err_call:
        return err_call, status_code

    # Properly URL-encode object key while preserving forward slashes
    encoded_key = urllib.parse.quote(object_key, safe='/')
    bucket_region = region or DEFAULT_REGION
    public_url = f"https://{bucket_name}.s3.{bucket_region}.amazonaws.com/{encoded_key}"

    return {
        'previewUrl': res,
        'url': res,
        'presigned_url': res,
        'public_url': public_url,
        'object_key': object_key,
        'bucket_name': bucket_name,
        'region': bucket_region,
        'expires_in': expires_in
    }, 200


def download_object_service(user, bucket_name, object_key, requested_account_id=None):
    """Downloads an S3 object as a stream using send_file or returns presigned URL metadata."""
    if not bucket_name or not object_key:
        return {'error': 'bucket_name and object_key are required.', 'code': 'InvalidParameterValue'}, 400

    s3_client, region, target_acc, err, sc = get_s3_client_for_bucket(
        user, bucket_name, requested_account_id=requested_account_id
    )
    if err or not s3_client:
        return err, sc

    from services.notification_service import create_notification
    res, err_call, status_code = AWSClientManager.execute_aws_call(
        s3_client, 's3', 'get_object', target_acc, region, 'get_object',
        Bucket=bucket_name, Key=object_key
    )
    if err_call:
        err_msg = err_call.get('aws_error_message') or err_call.get('error')
        create_notification(user.id, 'ERROR', 'S3 Operation Failed', f'Failed to download {object_key} from {bucket_name}: {err_msg}', severity='ERROR', resource_type='S3', resource_id=object_key, aws_account_id=target_acc.id if target_acc else None)
        return err_call, status_code

    file_stream = io.BytesIO(res['Body'].read())
    download_filename = object_key.split('/')[-1] or 'download'
    content_type = res.get('ContentType', 'application/octet-stream')

    create_notification(user.id, 'INFO', 'File Downloaded', f'{download_filename} downloaded from bucket {bucket_name}.', severity='INFO', resource_type='S3', resource_id=object_key, aws_account_id=target_acc.id if target_acc else None)

    return send_file(
        file_stream,
        download_name=download_filename,
        as_attachment=True,
        mimetype=content_type
    )


def head_object_service(user, bucket_name, object_key, requested_account_id=None):
    """Retrieves full object metadata (HeadObject) and public URL in ap-south-1."""
    if not bucket_name or not object_key:
        return {'error': 'bucket_name and object_key are required.', 'code': 'InvalidParameterValue'}, 400

    s3_client, region, target_acc, err, sc = get_s3_client_for_bucket(
        user, bucket_name, requested_account_id=requested_account_id
    )
    if err or not s3_client:
        return err, sc

    res, err_call, status_code = AWSClientManager.execute_aws_call(
        s3_client, 's3', 'head_object', target_acc, region, 'head_object',
        Bucket=bucket_name, Key=object_key
    )
    if err_call:
        return err_call, status_code

    last_mod = res['LastModified'].strftime('%Y-%m-%d %H:%M:%S') if res.get('LastModified') else 'N/A'
    bucket_region = region or DEFAULT_REGION
    encoded_key = urllib.parse.quote(object_key, safe='/')
    public_url = f"https://{bucket_name}.s3.{bucket_region}.amazonaws.com/{encoded_key}"

    return {
        'key': object_key,
        'bucket': bucket_name,
        'region': bucket_region,
        'public_url': public_url,
        's3_uri': f"s3://{bucket_name}/{object_key}",
        'size_bytes': res.get('ContentLength', 0),
        'size_formatted': format_size(res.get('ContentLength', 0)),
        'content_type': res.get('ContentType', 'application/octet-stream'),
        'last_modified': last_mod,
        'etag': res.get('ETag', '').strip('"'),
        'storage_class': res.get('StorageClass', 'STANDARD'),
        'metadata': res.get('Metadata', {}),
        'aws_account_name': target_acc.account_name if target_acc else 'AWS'
    }, 200


def delete_object_service(user, bucket_name, object_key, requested_account_id=None):
    """Deletes an object or recursively deletes all objects under a folder prefix in ap-south-1."""
    if not bucket_name or not object_key:
        return {'error': 'bucket_name and object_key are required.', 'code': 'InvalidParameterValue'}, 400

    s3_client, region, target_acc, err, sc = get_s3_client_for_bucket(
        user, bucket_name, requested_account_id=requested_account_id
    )
    if err or not s3_client:
        return err, sc

    from services.notification_service import create_notification
    if object_key.endswith('/'):
        objs, _, _ = AWSClientManager.execute_aws_call(
            s3_client, 's3', 'list_objects_v2', target_acc, region, 'list_objects_v2',
            Bucket=bucket_name, Prefix=object_key
        )
        if objs and objs.get('Contents'):
            delete_keys = [{'Key': item['Key']} for item in objs['Contents']]
            AWSClientManager.execute_aws_call(
                s3_client, 's3', 'delete_objects', target_acc, region, 'delete_objects',
                Bucket=bucket_name, Delete={'Objects': delete_keys}
            )
            create_notification(user.id, 'SUCCESS', 'File Deleted', f'Folder {object_key} and contents deleted from bucket {bucket_name}.', severity='SUCCESS', resource_type='S3', resource_id=object_key, aws_account_id=target_acc.id if target_acc else None)
    else:
        res, err_call, status_code = AWSClientManager.execute_aws_call(
            s3_client, 's3', 'delete_object', target_acc, region, 'delete_object',
            Bucket=bucket_name, Key=object_key
        )
        if err_call:
            err_msg = err_call.get('aws_error_message') or err_call.get('error')
            create_notification(user.id, 'ERROR', 'S3 Operation Failed', f'Failed to delete {object_key} from {bucket_name}: {err_msg}', severity='ERROR', resource_type='S3', resource_id=object_key, aws_account_id=target_acc.id if target_acc else None)
            return err_call, status_code

        create_notification(user.id, 'SUCCESS', 'File Deleted', f'{object_key} deleted from bucket {bucket_name}.', severity='SUCCESS', resource_type='S3', resource_id=object_key, aws_account_id=target_acc.id if target_acc else None)

    return {'message': f'✅ Deleted "{object_key}" successfully.'}, 200


def rename_object_service(user, bucket_name, source_key, new_key, requested_account_id=None):
    """Renames an S3 object key via CopyObject + DeleteObject in ap-south-1."""
    if not bucket_name or not source_key or not new_key:
        return {'error': 'bucket_name, source_key, and new_key are required.', 'code': 'InvalidParameterValue'}, 400

    if source_key == new_key:
        return {'message': 'Source key and new key are identical.'}, 200

    s3_client, region, target_acc, err, sc = get_s3_client_for_bucket(
        user, bucket_name, requested_account_id=requested_account_id
    )
    if err or not s3_client:
        return err, sc

    copy_source = {'Bucket': bucket_name, 'Key': source_key}
    res, err_call, status_code = AWSClientManager.execute_aws_call(
        s3_client, 's3', 'copy_object', target_acc, region, 'copy_object',
        CopySource=copy_source, Bucket=bucket_name, Key=new_key
    )
    if err_call:
        return err_call, status_code

    AWSClientManager.execute_aws_call(
        s3_client, 's3', 'delete_object', target_acc, region, 'delete_object',
        Bucket=bucket_name, Key=source_key
    )

    return {'message': f'✅ Renamed "{source_key}" to "{new_key}".', 'new_key': new_key}, 200

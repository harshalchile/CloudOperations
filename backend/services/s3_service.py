import io
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from models.aws_account import AWSAccount
from services.aws_service import get_target_aws_accounts
from utils.aws_audit import log_aws_call, extract_client_error, verify_sts_identity
from flask import send_file

MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB

def get_s3_client_for_account(acc, req_region=None):
    """Instantiates an S3 client after verifying STS caller identity."""
    identity, sts_err, status_code = verify_sts_identity(acc)
    if sts_err:
        return None, acc.region, sts_err, status_code

    region = req_region or acc.region or 'us-east-1'
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=acc.get_decrypted_access_key(),
            aws_secret_access_key=acc.get_decrypted_secret_key(),
            region_name=region
        )
        return s3_client, region, None, 200
    except ClientError as e:
        err_dict, sc = extract_client_error(e, "S3 Client Creation Failed")
        return None, region, err_dict, sc
    except Exception as e:
        return None, region, {'error': f'Failed to create S3 client: {str(e)}'}, 400


def get_s3_client_for_bucket(user, bucket_name):
    accounts = get_target_aws_accounts(user)
    for acc in accounts:
        s3, region, err, sc = get_s3_client_for_account(acc)
        if err or not s3:
            continue
        try:
            log_aws_call('s3', 'head_bucket', {'Bucket': bucket_name})
            s3.head_bucket(Bucket=bucket_name)
            return s3, region, acc, None
        except Exception:
            pass

    all_accs = AWSAccount.query.filter_by(user_id=user.id).all()
    for acc in all_accs:
        s3, region, err, sc = get_s3_client_for_account(acc)
        if err or not s3:
            continue
        try:
            log_aws_call('s3', 'head_bucket', {'Bucket': bucket_name})
            s3.head_bucket(Bucket=bucket_name)
            return s3, region, acc, None
        except Exception:
            pass

    if all_accs:
        s3, region, err, sc = get_s3_client_for_account(all_accs[0])
        return s3, region, all_accs[0], None

    return None, None, None, ({'error': 'No AWS Account connected.'}, 400)


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


def list_buckets_service(user):
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'buckets': [], 'count': 0, 'total_storage_formatted': '0 B', 'total_objects': 0}, 200

    combined_buckets = []
    total_storage_bytes = 0
    total_object_count = 0

    for acc in accounts:
        s3, user_region, err, sc = get_s3_client_for_account(acc)
        if err or not s3:
            continue

        try:
            log_aws_call('s3', 'list_buckets', {'account_name': acc.account_name})
            response = s3.list_buckets()
            raw_buckets = response.get('Buckets', [])

            for b in raw_buckets:
                bucket_name = b['Name']
                creation_date = b['CreationDate'].strftime('%Y-%m-%d %H:%M:%S') if b.get('CreationDate') else 'N/A'
                
                region = user_region or 'us-east-1'
                try:
                    loc_res = s3.get_bucket_location(Bucket=bucket_name)
                    loc = loc_res.get('LocationConstraint')
                    if loc is None:
                        region = 'us-east-1'
                    elif loc == 'EU':
                        region = 'eu-west-1'
                    else:
                        region = loc
                except Exception:
                    region = user_region

                obj_count = 0
                storage_bytes = 0
                try:
                    objs_res = s3.list_objects_v2(Bucket=bucket_name, MaxKeys=1000)
                    contents = objs_res.get('Contents', [])
                    obj_count = len(contents)
                    storage_bytes = sum(item.get('Size', 0) for item in contents)
                    if objs_res.get('IsTruncated'):
                        obj_count = objs_res.get('KeyCount', 1000)
                except Exception:
                    pass

                total_storage_bytes += storage_bytes
                total_object_count += obj_count

                combined_buckets.append({
                    'name': bucket_name,
                    'region': region,
                    'created': creation_date,
                    'objects_count': obj_count,
                    'size_bytes': storage_bytes,
                    'size_formatted': format_size(storage_bytes),
                    'aws_account_id': acc.id,
                    'aws_account_name': acc.account_name,
                    'aws_account_num': acc.account_id or 'N/A'
                })
        except Exception:
            pass

    return {
        'buckets': combined_buckets,
        'count': len(combined_buckets),
        'total_storage_formatted': format_size(total_storage_bytes),
        'total_objects': total_object_count
    }, 200


def create_bucket_service(user, bucket_name, req_region=None):
    """
    Creates an S3 Bucket with location constraint verification, parameter logging,
    and exact AWS ClientError exception returning.
    """
    if not bucket_name or not bucket_name.strip():
        return {'error': 'Bucket name is required.'}, 400

    clean_name = bucket_name.strip().lower()
    accounts = get_target_aws_accounts(user)
    if not accounts:
        return {'error': 'No connected AWS accounts.'}, 400

    target_acc = accounts[0]
    target_region = req_region or target_acc.region or 'us-east-1'

    s3, user_region, err, status_code = get_s3_client_for_account(target_acc, req_region=target_region)
    if err or not s3:
        return err or {'error': 'Failed to create S3 client.'}, status_code

    # Build CreateBucket Request Payload
    create_kwargs = {'Bucket': clean_name}
    if target_region and target_region != 'us-east-1':
        create_kwargs['CreateBucketConfiguration'] = {'LocationConstraint': target_region}

    log_aws_call('s3', 'create_bucket', create_kwargs, {'account_name': target_acc.account_name, 'account_id': target_acc.account_id})

    try:
        response = s3.create_bucket(**create_kwargs)
        logger.info(f"<== S3 BUCKET CREATED SUCCESSFULLY: Bucket={clean_name}, Region={target_region}, Location={response.get('Location')}")

        return {
            'message': f'Bucket "{clean_name}" created successfully in account "{target_acc.account_name}".',
            'bucket_name': clean_name,
            'region': target_region,
            'location': response.get('Location')
        }, 201

    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "S3 CreateBucket Failed")
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to create bucket: {str(e)}'}, 500


def delete_bucket_service(user, bucket_name):
    if not bucket_name:
        return {'error': 'Bucket name is required.'}, 400

    s3, _, _, err = get_s3_client_for_bucket(user, bucket_name)
    if err or not s3:
        return err or ({'error': 'Failed to resolve bucket owner.'}, 400)

    try:
        log_aws_call('s3', 'delete_bucket', {'Bucket': bucket_name})
        s3.delete_bucket(Bucket=bucket_name)
        return {'message': f'Bucket "{bucket_name}" deleted successfully.'}, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "S3 DeleteBucket Failed")
        return err_dict, status_code
    except Exception as e:
        return {'error': str(e)}, 500


def list_objects_service(user, bucket_name, prefix=''):
    if not bucket_name:
        return {'error': 'Bucket name is required.'}, 400

    s3, region, acc, err = get_s3_client_for_bucket(user, bucket_name)
    if err or not s3:
        return err or ({'error': 'Failed to resolve bucket.'}, 400)

    if prefix and not prefix.endswith('/'):
        prefix = prefix + '/'

    try:
        kwargs = {'Bucket': bucket_name, 'Delimiter': '/'}
        if prefix:
            kwargs['Prefix'] = prefix

        log_aws_call('s3', 'list_objects_v2', kwargs)
        response = s3.list_objects_v2(**kwargs)
        
        raw_folders = response.get('CommonPrefixes', [])
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

        raw_objects = response.get('Contents', [])
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
            'aws_account_name': acc.account_name if acc else 'AWS'
        }, 200

    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "S3 ListObjectsV2 Failed")
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to list bucket contents: {str(e)}'}, 500


def create_folder_service(user, bucket_name, folder_path):
    if not bucket_name or not folder_path:
        return {'error': 'bucket_name and folder_path are required.'}, 400

    folder_path = folder_path.strip()
    if not folder_path.endswith('/'):
        folder_path = folder_path + '/'

    s3, _, _, err = get_s3_client_for_bucket(user, bucket_name)
    if err or not s3:
        return err or ({'error': 'Failed to resolve bucket.'}, 400)

    try:
        log_aws_call('s3', 'put_object', {'Bucket': bucket_name, 'Key': folder_path})
        s3.put_object(Bucket=bucket_name, Key=folder_path)
        return {'message': f'Folder "{folder_path}" created successfully.', 'folder_key': folder_path}, 201
    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "S3 CreateFolder Failed")
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to create folder: {str(e)}'}, 500


def upload_object_service(user, bucket_name, file_obj, filename, prefix=''):
    if not bucket_name or not file_obj or not filename:
        return {'error': 'Bucket name, file, and filename are required.'}, 400

    file_obj.seek(0, 2)
    file_size = file_obj.tell()
    file_obj.seek(0)

    if file_size > MAX_FILE_SIZE_BYTES:
        return {'error': f'File exceeds maximum size limit of 100 MB.'}, 400

    s3, _, _, err = get_s3_client_for_bucket(user, bucket_name)
    if err or not s3:
        return err or ({'error': 'Failed to resolve bucket.'}, 400)

    if prefix and not prefix.endswith('/'):
        prefix = prefix + '/'

    object_key = f"{prefix}{filename}" if prefix else filename

    try:
        import mimetypes
        guessed_type, _ = mimetypes.guess_type(filename)
        content_type = guessed_type or getattr(file_obj, 'content_type', None) or 'application/octet-stream'

        log_aws_call('s3', 'upload_fileobj', {'Bucket': bucket_name, 'Key': object_key, 'Size': file_size})
        s3.upload_fileobj(
            file_obj,
            bucket_name,
            object_key,
            ExtraArgs={'ContentType': content_type}
        )

        return {
            'message': f'File "{filename}" uploaded successfully to "{bucket_name}".',
            'object_key': object_key,
            'size_formatted': format_size(file_size)
        }, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "S3 UploadFile Failed")
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to upload file: {str(e)}'}, 500


def get_presigned_url_service(user, bucket_name, object_key, expires_in=3600):
    if not bucket_name or not object_key:
        return {'error': 'bucket_name and object_key are required.'}, 400

    s3, _, _, err = get_s3_client_for_bucket(user, bucket_name)
    if err or not s3:
        return err or ({'error': 'Failed to resolve bucket.'}, 400)

    try:
        log_aws_call('s3', 'generate_presigned_url', {'Bucket': bucket_name, 'Key': object_key, 'ExpiresIn': expires_in})
        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': object_key},
            ExpiresIn=expires_in
        )
        return {
            'previewUrl': url,
            'url': url,
            'object_key': object_key,
            'expires_in': expires_in
        }, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "S3 PresignedURL Failed")
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to generate presigned URL: {str(e)}'}, 500


def download_object_service(user, bucket_name, object_key):
    if not bucket_name or not object_key:
        return {'error': 'bucket_name and object_key are required.'}, 400

    s3, _, _, err = get_s3_client_for_bucket(user, bucket_name)
    if err or not s3:
        return err or ({'error': 'Failed to resolve bucket.'}, 400)

    try:
        log_aws_call('s3', 'get_object', {'Bucket': bucket_name, 'Key': object_key})
        response = s3.get_object(Bucket=bucket_name, Key=object_key)
        file_stream = io.BytesIO(response['Body'].read())
        download_filename = object_key.split('/')[-1]
        content_type = response.get('ContentType', 'application/octet-stream')

        return send_file(
            file_stream,
            download_name=download_filename,
            as_attachment=True,
            mimetype=content_type
        )
    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "S3 DownloadObject Failed")
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to download file: {str(e)}'}, 500


def head_object_service(user, bucket_name, object_key):
    if not bucket_name or not object_key:
        return {'error': 'bucket_name and object_key are required.'}, 400

    s3, _, _, err = get_s3_client_for_bucket(user, bucket_name)
    if err or not s3:
        return err or ({'error': 'Failed to resolve bucket.'}, 400)

    try:
        log_aws_call('s3', 'head_object', {'Bucket': bucket_name, 'Key': object_key})
        res = s3.head_object(Bucket=bucket_name, Key=object_key)
        last_mod = res['LastModified'].strftime('%Y-%m-%d %H:%M:%S') if res.get('LastModified') else 'N/A'
        
        return {
            'key': object_key,
            'size_bytes': res.get('ContentLength', 0),
            'size_formatted': format_size(res.get('ContentLength', 0)),
            'content_type': res.get('ContentType', 'application/octet-stream'),
            'last_modified': last_mod,
            'etag': res.get('ETag', '').strip('"'),
            'storage_class': res.get('StorageClass', 'STANDARD'),
            'metadata': res.get('Metadata', {})
        }, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "S3 HeadObject Failed")
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to get object properties: {str(e)}'}, 500


def delete_object_service(user, bucket_name, object_key):
    if not bucket_name or not object_key:
        return {'error': 'bucket_name and object_key are required.'}, 400

    s3, _, _, err = get_s3_client_for_bucket(user, bucket_name)
    if err or not s3:
        return err or ({'error': 'Failed to resolve bucket.'}, 400)

    try:
        log_aws_call('s3', 'delete_object', {'Bucket': bucket_name, 'Key': object_key})
        if object_key.endswith('/'):
            objs = s3.list_objects_v2(Bucket=bucket_name, Prefix=object_key)
            for item in objs.get('Contents', []):
                s3.delete_object(Bucket=bucket_name, Key=item['Key'])
        else:
            s3.delete_object(Bucket=bucket_name, Key=object_key)

        return {'message': f'Deleted "{object_key}" successfully.'}, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "S3 DeleteObject Failed")
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to delete: {str(e)}'}, 500


def rename_object_service(user, bucket_name, source_key, new_key):
    if not bucket_name or not source_key or not new_key:
        return {'error': 'bucket_name, source_key, and new_key are required.'}, 400

    if source_key == new_key:
        return {'message': 'Source key and new key are identical.'}, 200

    s3, _, _, err = get_s3_client_for_bucket(user, bucket_name)
    if err or not s3:
        return err or ({'error': 'Failed to resolve bucket.'}, 400)

    try:
        copy_source = {'Bucket': bucket_name, 'Key': source_key}
        log_aws_call('s3', 'copy_object', {'CopySource': copy_source, 'Bucket': bucket_name, 'Key': new_key})
        s3.copy_object(CopySource=copy_source, Bucket=bucket_name, Key=new_key)
        s3.delete_object(Bucket=bucket_name, Key=source_key)

        return {'message': f'Renamed "{source_key}" to "{new_key}".', 'new_key': new_key}, 200
    except ClientError as e:
        err_dict, status_code = extract_client_error(e, "S3 RenameObject Failed")
        return err_dict, status_code
    except Exception as e:
        return {'error': f'Failed to rename object: {str(e)}'}, 500

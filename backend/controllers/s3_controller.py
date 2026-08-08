from flask import request, jsonify
from services.s3_service import (
    list_buckets_service,
    create_bucket_service,
    delete_bucket_service,
    list_objects_service,
    create_folder_service,
    upload_object_service,
    get_presigned_url_service,
    download_object_service,
    head_object_service,
    delete_object_service,
    rename_object_service
)

def list_buckets_controller(current_user):
    account_id = request.args.get('account_id') or request.args.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    data, code = list_buckets_service(current_user, requested_account_id=account_id)
    return jsonify(data), code

def create_bucket_controller(current_user):
    payload = request.get_json() or {}
    bucket_name = payload.get('bucket_name')
    region = payload.get('region') or 'ap-south-1'
    account_id = payload.get('account_id') or payload.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')

    data, code = create_bucket_service(current_user, bucket_name, req_region=region, requested_account_id=account_id)
    return jsonify(data), code

def delete_bucket_controller(current_user, bucket_name):
    account_id = request.args.get('account_id') or request.args.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    data, code = delete_bucket_service(current_user, bucket_name, requested_account_id=account_id)
    return jsonify(data), code

def list_objects_controller(current_user, bucket_name):
    prefix = request.args.get('prefix', '')
    account_id = request.args.get('account_id') or request.args.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')
    data, code = list_objects_service(current_user, bucket_name, prefix=prefix, requested_account_id=account_id)
    return jsonify(data), code

def create_folder_controller(current_user):
    payload = request.get_json() or {}
    bucket_name = payload.get('bucket_name')
    folder_path = payload.get('folder_path')
    account_id = payload.get('account_id') or payload.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')

    data, code = create_folder_service(current_user, bucket_name, folder_path, requested_account_id=account_id)
    return jsonify(data), code

def upload_object_controller(current_user):
    if 'file' not in request.files and 'files' not in request.files:
        return jsonify({'error': 'No file attachment found in request.', 'code': 'InvalidParameterValue'}), 400

    bucket_name = request.form.get('bucket_name')
    prefix = request.form.get('prefix', '')
    account_id = request.form.get('account_id') or request.form.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')

    files = request.files.getlist('files') or ([request.files['file']] if 'file' in request.files else [])

    results = []
    for file in files:
        if file and file.filename != '':
            filename = file.filename
            data, code = upload_object_service(current_user, bucket_name, file, filename, prefix=prefix, requested_account_id=account_id)
            if code != 200:
                return jsonify(data), code
            results.append(data)

    return jsonify({'message': f'Uploaded {len(results)} file(s) successfully to {bucket_name}.', 'results': results}), 200

def get_presigned_url_controller(current_user):
    bucket_name = request.args.get('bucket') or request.args.get('bucket_name')
    object_key = request.args.get('key') or request.args.get('object_key')
    expires_in = int(request.args.get('expires_in', 3600))
    account_id = request.args.get('account_id') or request.args.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')

    data, code = get_presigned_url_service(current_user, bucket_name, object_key, expires_in=expires_in, requested_account_id=account_id)
    return jsonify(data), code

def preview_object_controller(current_user):
    bucket_name = request.args.get('bucket') or request.args.get('bucket_name')
    object_key = request.args.get('key') or request.args.get('object_key')
    account_id = request.args.get('account_id') or request.args.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')

    data, code = get_presigned_url_service(current_user, bucket_name, object_key, expires_in=3600, requested_account_id=account_id)
    return jsonify(data), code

def download_object_controller(current_user):
    bucket_name = request.args.get('bucket_name') or request.args.get('bucket')
    object_key = request.args.get('object_key') or request.args.get('key')
    account_id = request.args.get('account_id') or request.args.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')

    res = download_object_service(current_user, bucket_name, object_key, requested_account_id=account_id)
    if isinstance(res, tuple):
        data, code = res
        return jsonify(data), code
    return res

def head_object_controller(current_user):
    bucket_name = request.args.get('bucket_name') or request.args.get('bucket')
    object_key = request.args.get('object_key') or request.args.get('key')
    account_id = request.args.get('account_id') or request.args.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')

    data, code = head_object_service(current_user, bucket_name, object_key, requested_account_id=account_id)
    return jsonify(data), code

def delete_object_controller(current_user):
    payload = request.get_json(silent=True) or {}
    bucket_name = request.args.get('bucket_name') or payload.get('bucket_name')
    object_key = request.args.get('object_key') or payload.get('object_key')
    account_id = request.args.get('account_id') or payload.get('account_id') or request.headers.get('X-AWS-Account-ID')

    data, code = delete_object_service(current_user, bucket_name, object_key, requested_account_id=account_id)
    return jsonify(data), code

def rename_object_controller(current_user):
    payload = request.get_json() or {}
    bucket_name = payload.get('bucket_name')
    source_key = payload.get('source_key')
    new_key = payload.get('new_key')
    account_id = payload.get('account_id') or payload.get('aws_account_id') or request.headers.get('X-AWS-Account-ID')

    data, code = rename_object_service(current_user, bucket_name, source_key, new_key, requested_account_id=account_id)
    return jsonify(data), code

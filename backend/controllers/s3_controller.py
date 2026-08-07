from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.user import User
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

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(user_id)

@jwt_required()
def list_buckets():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404
    data, code = list_buckets_service(user)
    return jsonify(data), code

@jwt_required()
def create_bucket():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    payload = request.get_json() or {}
    bucket_name = payload.get('bucket_name')
    region = payload.get('region')

    data, code = create_bucket_service(user, bucket_name, region)
    return jsonify(data), code

@jwt_required()
def delete_bucket(bucket_name):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    data, code = delete_bucket_service(user, bucket_name)
    return jsonify(data), code

@jwt_required()
def list_objects(bucket_name):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    prefix = request.args.get('prefix', '')
    data, code = list_objects_service(user, bucket_name, prefix)
    return jsonify(data), code

@jwt_required()
def create_folder():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    payload = request.get_json() or {}
    bucket_name = payload.get('bucket_name')
    folder_path = payload.get('folder_path')

    data, code = create_folder_service(user, bucket_name, folder_path)
    return jsonify(data), code

@jwt_required()
def upload_object():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    if 'file' not in request.files and 'files' not in request.files:
        return jsonify({'error': 'No file attachment found in request.'}), 400

    bucket_name = request.form.get('bucket_name')
    prefix = request.form.get('prefix', '')
    
    files = request.files.getlist('files') or ([request.files['file']] if 'file' in request.files else [])

    results = []
    for file in files:
        if file and file.filename != '':
            filename = file.filename
            data, code = upload_object_service(user, bucket_name, file, filename, prefix=prefix)
            if code != 200:
                return jsonify(data), code
            results.append(data)

    return jsonify({'message': f'Uploaded {len(results)} file(s) successfully.', 'results': results}), 200

@jwt_required()
def get_presigned_url():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    bucket_name = request.args.get('bucket') or request.args.get('bucket_name')
    object_key = request.args.get('key') or request.args.get('object_key')
    expires_in = int(request.args.get('expires_in', 3600))

    data, code = get_presigned_url_service(user, bucket_name, object_key, expires_in=expires_in)
    return jsonify(data), code

@jwt_required()
def preview_object():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    bucket_name = request.args.get('bucket') or request.args.get('bucket_name')
    object_key = request.args.get('key') or request.args.get('object_key')

    data, code = get_presigned_url_service(user, bucket_name, object_key, expires_in=3600)
    return jsonify(data), code

@jwt_required()
def download_object():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    bucket_name = request.args.get('bucket_name')
    object_key = request.args.get('object_key')

    res = download_object_service(user, bucket_name, object_key)
    if isinstance(res, tuple):
        data, code = res
        return jsonify(data), code
    return res

@jwt_required()
def head_object():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    bucket_name = request.args.get('bucket_name')
    object_key = request.args.get('object_key')

    data, code = head_object_service(user, bucket_name, object_key)
    return jsonify(data), code

@jwt_required()
def delete_object():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    bucket_name = request.args.get('bucket_name') or (request.get_json() or {}).get('bucket_name')
    object_key = request.args.get('object_key') or (request.get_json() or {}).get('object_key')

    data, code = delete_object_service(user, bucket_name, object_key)
    return jsonify(data), code

@jwt_required()
def rename_object():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User session not found.'}), 404

    payload = request.get_json() or {}
    bucket_name = payload.get('bucket_name')
    source_key = payload.get('source_key')
    new_key = payload.get('new_key')

    data, code = rename_object_service(user, bucket_name, source_key, new_key)
    return jsonify(data), code

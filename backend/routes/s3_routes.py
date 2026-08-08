from flask import Blueprint
from controllers.s3_controller import (
    list_buckets_controller,
    create_bucket_controller,
    delete_bucket_controller,
    list_objects_controller,
    create_folder_controller,
    upload_object_controller,
    get_presigned_url_controller,
    preview_object_controller,
    download_object_controller,
    head_object_controller,
    delete_object_controller,
    rename_object_controller
)
from middleware.jwt_auth import jwt_required_custom

s3_bp = Blueprint('s3', __name__, url_prefix='/api/s3')

s3_bp.route('/buckets', methods=['GET'])(jwt_required_custom(list_buckets_controller))
s3_bp.route('/buckets', methods=['POST'])(jwt_required_custom(create_bucket_controller))
s3_bp.route('/buckets/<path:bucket_name>', methods=['DELETE'])(jwt_required_custom(delete_bucket_controller))
s3_bp.route('/buckets/<path:bucket_name>/objects', methods=['GET'])(jwt_required_custom(list_objects_controller))
s3_bp.route('/folder', methods=['POST'])(jwt_required_custom(create_folder_controller))
s3_bp.route('/upload', methods=['POST'])(jwt_required_custom(upload_object_controller))
s3_bp.route('/presigned', methods=['GET'])(jwt_required_custom(get_presigned_url_controller))
s3_bp.route('/preview', methods=['GET'])(jwt_required_custom(preview_object_controller))
s3_bp.route('/download', methods=['GET'])(jwt_required_custom(download_object_controller))
s3_bp.route('/head', methods=['GET'])(jwt_required_custom(head_object_controller))
s3_bp.route('/object', methods=['DELETE'])(jwt_required_custom(delete_object_controller))
s3_bp.route('/rename', methods=['PUT'])(jwt_required_custom(rename_object_controller))

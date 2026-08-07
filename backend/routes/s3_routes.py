from flask import Blueprint
from controllers.s3_controller import (
    list_buckets,
    create_bucket,
    delete_bucket,
    list_objects,
    create_folder,
    upload_object,
    get_presigned_url,
    preview_object,
    download_object,
    head_object,
    delete_object,
    rename_object
)

s3_bp = Blueprint('s3', __name__, url_prefix='/api/s3')

s3_bp.route('/buckets', methods=['GET'])(list_buckets)
s3_bp.route('/buckets', methods=['POST'])(create_bucket)
s3_bp.route('/buckets/<path:bucket_name>', methods=['DELETE'])(delete_bucket)
s3_bp.route('/buckets/<path:bucket_name>/objects', methods=['GET'])(list_objects)
s3_bp.route('/folder', methods=['POST'])(create_folder)
s3_bp.route('/upload', methods=['POST'])(upload_object)
s3_bp.route('/presigned', methods=['GET'])(get_presigned_url)
s3_bp.route('/preview', methods=['GET'])(preview_object)
s3_bp.route('/download', methods=['GET'])(download_object)
s3_bp.route('/head', methods=['GET'])(head_object)
s3_bp.route('/object', methods=['DELETE'])(delete_object)
s3_bp.route('/rename', methods=['PUT'])(rename_object)

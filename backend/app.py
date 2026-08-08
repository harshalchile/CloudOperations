import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_migrate import Migrate, upgrade
from config import Config
from models.user import db
import models.aws_account # Ensure AWSAccount model is imported
import models.s3_watch
import models.alarm_state
from services.auth_service import bcrypt
from routes.auth_routes import auth_bp
from routes.profile_routes import profile_bp
from routes.aws_routes import aws_bp
from routes.ec2_routes import ec2_bp
from routes.s3_routes import s3_bp
from routes.cloudwatch_routes import cloudwatch_bp
from routes.notification_routes import notification_bp
from routes.terminal_routes import register_socket_events

socketio = SocketIO()
migrate = Migrate()

def auto_migrate_schema(app):
    """Verifies SQLite table schema and adds any missing columns automatically."""
    with app.app_context():
        import sqlite3
        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if db_uri.startswith('sqlite:///'):
            db_path = db_uri.replace('sqlite:///', '')
            if not os.path.isabs(db_path):
                inst_path = os.path.join(app.instance_path, os.path.basename(db_path))
                if os.path.exists(inst_path):
                    db_path = inst_path
                else:
                    db_path = os.path.join(app.root_path, db_path)

            if os.path.exists(db_path):
                try:
                    conn = sqlite3.connect(db_path)
                    cursor = conn.cursor()
                    
                    # Check aws_accounts table info
                    columns = [row[1] for row in cursor.execute("PRAGMA table_info(aws_accounts)").fetchall()]
                    if columns:
                        if 'account_name' not in columns:
                            cursor.execute("ALTER TABLE aws_accounts ADD COLUMN account_name VARCHAR(100) NOT NULL DEFAULT 'Personal AWS Account'")
                        if 'arn' not in columns:
                            cursor.execute("ALTER TABLE aws_accounts ADD COLUMN arn VARCHAR(255) NULL")
                        if 'account_id' not in columns:
                            cursor.execute("ALTER TABLE aws_accounts ADD COLUMN account_id VARCHAR(50) NULL")
                        if 'session_token_encrypted' not in columns:
                            cursor.execute("ALTER TABLE aws_accounts ADD COLUMN session_token_encrypted TEXT NULL")
                        conn.commit()
                    
                    conn.close()
                except Exception as e:
                    print(f"[MIGRATION WARNING] Failed auto column sync: {e}")

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable CORS for React frontend (Vite dev server)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    JWTManager(app)
    migrate.init_app(app, db, render_as_batch=True)
    socketio.init_app(app, cors_allowed_origins="*", async_mode="threading")

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(aws_bp)
    app.register_blueprint(ec2_bp)
    app.register_blueprint(s3_bp)
    app.register_blueprint(cloudwatch_bp)
    app.register_blueprint(notification_bp)

    # Register WebSocket SSH Events
    register_socket_events(socketio)

    # Auto migrate & sync tables
    with app.app_context():
        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        db_path = None
        db_exists = False
        if db_uri.startswith('sqlite:///'):
            db_rel = db_uri.replace('sqlite:///', '')
            if os.path.isabs(db_rel):
                db_path = db_rel
            else:
                inst_path = os.path.join(app.instance_path, os.path.basename(db_rel))
                if os.path.exists(inst_path):
                    db_path = inst_path
                else:
                    db_path = os.path.join(app.root_path, db_rel)
            db_exists = os.path.exists(db_path) if db_path else False

        print(f"[DB-STARTUP] Database URI: {db_uri}")
        print(f"[DB-STARTUP] Resolved Database Path: {db_path}")
        print(f"[DB-STARTUP] Database exists: {db_exists}")

        db.create_all()
        auto_migrate_schema(app)
        try:
            mig_dir = os.path.join(app.root_path, 'migrations')
            if os.path.exists(mig_dir) and os.path.exists(os.path.join(mig_dir, 'env.py')):
                upgrade(directory=mig_dir)
        except Exception as mig_err:
            pass

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'app': 'Cloud Operations Center API',
            'phase': 'Phase 2 - Live SSH Terminal Active'
        }), 200

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Requested API endpoint not found.'}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'error': 'Internal server error occurred.'}), 500

    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)

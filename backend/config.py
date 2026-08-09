import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

def get_database_uri():
    db_uri = os.getenv('DATABASE_URL', 'sqlite:///cloudops.db')
    if db_uri and db_uri.startswith('postgres://'):
        db_uri = db_uri.replace('postgres://', 'postgresql://', 1)
    return db_uri

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'default_secret_key_cloudops_2026')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt_default_secret_cloudops_2026')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    
    # Database Config with PostgreSQL / SQLite fallback
    SQLALCHEMY_DATABASE_URI = get_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    FERNET_KEY = os.getenv('FERNET_KEY', '8_WzP3kU7x4vKq1mRz6jL9yA2bC5dE8fG0hI3jK6lM4=')

    # AWS & S3 Presigned URL Config
    AWS_REGION = os.getenv('AWS_REGION', 'ap-south-1')
    S3_PRESIGNED_URL_EXPIRATION = int(os.getenv('S3_PRESIGNED_URL_EXPIRATION', 3600))

    # CORS Config
    FRONTEND_URL = os.getenv('FRONTEND_URL', '')
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '')


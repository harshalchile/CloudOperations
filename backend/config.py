import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'default_secret_key_cloudops_2026')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt_default_secret_cloudops_2026')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    
    # Database Config with SQLite fallback
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///cloudops.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    FERNET_KEY = os.getenv('FERNET_KEY', '8_WzP3kU7x4vKq1mRz6jL9yA2bC5dE8fG0hI3jK6lM4=')

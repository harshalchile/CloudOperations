from datetime import datetime
from models.user import db
from utils.encryption import decrypt_credential

class AWSAccount(db.Model):
    __tablename__ = 'aws_accounts'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    account_name = db.Column(db.String(100), nullable=False, server_default='Personal AWS Account', default='Personal AWS Account')
    access_key_encrypted = db.Column(db.Text, nullable=False)
    secret_key_encrypted = db.Column(db.Text, nullable=False)
    session_token_encrypted = db.Column(db.Text, nullable=True)
    region = db.Column(db.String(50), nullable=False, default='ap-south-1')
    account_id = db.Column(db.String(50), nullable=True)
    arn = db.Column(db.String(255), nullable=True)
    connected_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_decrypted_access_key(self):
        return decrypt_credential(self.access_key_encrypted)

    def get_decrypted_secret_key(self):
        return decrypt_credential(self.secret_key_encrypted)

    def get_decrypted_session_token(self):
        if self.session_token_encrypted:
            return decrypt_credential(self.session_token_encrypted)
        return None

    def to_dict(self):
        plain_key = self.get_decrypted_access_key()
        masked_key = f"{plain_key[:4]}****{plain_key[-4:]}" if len(plain_key) >= 8 else "****"

        return {
            'id': self.id,
            'user_id': self.user_id,
            'account_name': self.account_name,
            'account_id': self.account_id,
            'masked_access_key': masked_key,
            'region': self.region or 'ap-south-1',
            'arn': self.arn,
            'has_session_token': bool(self.session_token_encrypted),
            'connected_at': self.connected_at.isoformat() if self.connected_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_connected': True
        }

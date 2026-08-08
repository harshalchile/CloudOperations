from datetime import datetime
from models.user import db

class S3StorageWatch(db.Model):
    __tablename__ = 's3_storage_watches'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    aws_account_id = db.Column(db.Integer, db.ForeignKey('aws_accounts.id'), nullable=False, index=True)
    bucket_name = db.Column(db.String(255), nullable=False)
    threshold_gb = db.Column(db.Float, nullable=False, default=10.0)
    last_state = db.Column(db.String(20), nullable=False, default='OK')  # OK, EXCEEDED
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('s3_watches', lazy='dynamic', cascade='all, delete-orphan'))
    aws_account = db.relationship('AWSAccount', backref=db.backref('s3_watches', lazy='dynamic'))

    def to_dict(self):
        acc_name = self.aws_account.account_name if self.aws_account else 'N/A'
        acc_num = self.aws_account.account_id if self.aws_account else 'N/A'

        return {
            'id': self.id,
            'user_id': self.user_id,
            'aws_account_id': self.aws_account_id,
            'aws_account_name': acc_name,
            'aws_account_number': acc_num,
            'bucket_name': self.bucket_name,
            'threshold_gb': self.threshold_gb,
            'last_state': self.last_state,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

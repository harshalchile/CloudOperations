from datetime import datetime
from models.user import db

class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    aws_account_id = db.Column(db.Integer, db.ForeignKey('aws_accounts.id'), nullable=True, index=True)
    type = db.Column(db.String(20), nullable=False, default='INFO')  # SUCCESS, ERROR, INFO, WARNING
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), nullable=False, default='INFO')  # SUCCESS, ERROR, INFO, WARNING
    resource_type = db.Column(db.String(50), nullable=False, default='AUTH')  # EC2, S3, CLOUDWATCH, AWS_ACCOUNT, AUTH
    resource_id = db.Column(db.String(255), nullable=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    user = db.relationship('User', backref=db.backref('notifications', lazy='dynamic', cascade='all, delete-orphan'))
    aws_account = db.relationship('AWSAccount', backref=db.backref('notifications', lazy='dynamic'))

    def to_dict(self):
        acc_name = None
        acc_number = None
        if self.aws_account:
            acc_name = self.aws_account.account_name
            acc_number = self.aws_account.account_id

        return {
            'id': self.id,
            'user_id': self.user_id,
            'aws_account_id': self.aws_account_id,
            'aws_account_name': acc_name,
            'aws_account_number': acc_number,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'severity': self.severity,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

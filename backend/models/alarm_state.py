from datetime import datetime
from models.user import db

class AlarmStateTrack(db.Model):
    __tablename__ = 'alarm_state_tracks'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    aws_account_id = db.Column(db.Integer, db.ForeignKey('aws_accounts.id'), nullable=False, index=True)
    alarm_name = db.Column(db.String(255), nullable=False, index=True)
    resource_id = db.Column(db.String(255), nullable=True)
    track_type = db.Column(db.String(50), nullable=False, default='CPU_ALARM')
    last_state = db.Column(db.String(50), nullable=False, default='OK')
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('alarm_tracks', lazy='dynamic', cascade='all, delete-orphan'))
    aws_account = db.relationship('AWSAccount', backref=db.backref('alarm_tracks', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'aws_account_id': self.aws_account_id,
            'alarm_name': self.alarm_name,
            'resource_id': self.resource_id,
            'track_type': self.track_type,
            'last_state': self.last_state,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

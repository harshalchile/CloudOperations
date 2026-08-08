"""add_s3_watches_and_alarm_tracks

Revision ID: d800773ef104
Revises: c700662df093
Create Date: 2026-08-08 14:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd800773ef104'
down_revision = 'c700662df093'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        's3_storage_watches',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('aws_account_id', sa.Integer(), nullable=False),
        sa.Column('bucket_name', sa.String(length=255), nullable=False),
        sa.Column('threshold_gb', sa.Float(), nullable=False, server_default='10.0'),
        sa.Column('last_state', sa.String(length=20), nullable=False, server_default='OK'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['aws_account_id'], ['aws_accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_s3_storage_watches_user_id', 's3_storage_watches', ['user_id'], unique=False)
    op.create_index('ix_s3_storage_watches_aws_account_id', 's3_storage_watches', ['aws_account_id'], unique=False)

    op.create_table(
        'alarm_state_tracks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('aws_account_id', sa.Integer(), nullable=False),
        sa.Column('alarm_name', sa.String(length=255), nullable=False),
        sa.Column('resource_id', sa.String(length=255), nullable=True),
        sa.Column('track_type', sa.String(length=50), nullable=False, server_default='CPU_ALARM'),
        sa.Column('last_state', sa.String(length=50), nullable=False, server_default='OK'),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['aws_account_id'], ['aws_accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_alarm_state_tracks_user_id', 'alarm_state_tracks', ['user_id'], unique=False)
    op.create_index('ix_alarm_state_tracks_aws_account_id', 'alarm_state_tracks', ['aws_account_id'], unique=False)
    op.create_index('ix_alarm_state_tracks_alarm_name', 'alarm_state_tracks', ['alarm_name'], unique=False)


def downgrade():
    op.drop_index('ix_alarm_state_tracks_alarm_name', table_name='alarm_state_tracks')
    op.drop_index('ix_alarm_state_tracks_aws_account_id', table_name='alarm_state_tracks')
    op.drop_index('ix_alarm_state_tracks_user_id', table_name='alarm_state_tracks')
    op.drop_table('alarm_state_tracks')

    op.drop_index('ix_s3_storage_watches_aws_account_id', table_name='s3_storage_watches')
    op.drop_index('ix_s3_storage_watches_user_id', table_name='s3_storage_watches')
    op.drop_table('s3_storage_watches')

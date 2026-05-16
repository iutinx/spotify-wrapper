"""add user activity and privacy settings

Revision ID: 3c8e9a2b1f4d
Revises: e14dcf734a5d
Create Date: 2026-05-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


revision = '3c8e9a2b1f4d'
down_revision = 'e14dcf734a5d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # add activity_visibility to user_profiles
    op.add_column(
        'user_profiles',
        sa.Column('activity_visibility', sa.String(20), nullable=False, server_default='friends_only')
    )

    # create user_activity table
    op.create_table(
        'user_activity',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('spotify_track_id', sa.String(255), nullable=True),
        sa.Column('track_name', sa.String(500), nullable=True),
        sa.Column('artist_name', sa.String(500), nullable=True),
        sa.Column('album_name', sa.String(500), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('is_playing', sa.Boolean(), nullable=False, default=False),
        sa.Column('progress_ms', sa.Integer(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=sa.func.now()),
    )
    op.create_index('idx_user_activity_user_id', 'user_activity', ['user_id'])

    # create user_activity_history table
    op.create_table(
        'user_activity_history',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('spotify_track_id', sa.String(255), nullable=False),
        sa.Column('track_name', sa.String(500), nullable=False),
        sa.Column('artist_name', sa.String(500), nullable=False),
        sa.Column('album_name', sa.String(500), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False, default=sa.func.now()),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_user_activity_history_user_id', 'user_activity_history', ['user_id'])
    op.create_index('idx_user_activity_history_started', 'user_activity_history', ['started_at'])


def downgrade() -> None:
    op.drop_index('idx_user_activity_history_started', table_name='user_activity_history')
    op.drop_index('idx_user_activity_history_user_id', table_name='user_activity_history')
    op.drop_table('user_activity_history')

    op.drop_index('idx_user_activity_user_id', table_name='user_activity')
    op.drop_table('user_activity')

    op.drop_column('user_profiles', 'activity_visibility')

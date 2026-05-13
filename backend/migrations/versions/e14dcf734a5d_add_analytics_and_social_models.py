"""add analytics and social models

Revision ID: e14dcf734a5d
Revises: 4dbcd5b12d2f
Create Date: 2026-05-13 20:51:04.451935

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


revision = 'e14dcf734a5d'
down_revision = '4dbcd5b12d2f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_top_tracks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('spotify_track_id', sa.String(255), nullable=False),
        sa.Column('track_name', sa.String(500), nullable=False),
        sa.Column('artist_name', sa.String(500), nullable=False),
        sa.Column('album_name', sa.String(500), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('time_range', sa.String(20), nullable=False),
        sa.Column('rank', sa.Integer(), nullable=False),
        sa.Column('fetched_at', sa.DateTime(), nullable=False, default=sa.func.now()),
    )
    op.create_index('idx_top_tracks_user_time', 'user_top_tracks', ['user_id', 'time_range'])
    op.create_index('idx_top_tracks_spotify_id', 'user_top_tracks', ['spotify_track_id'])

    op.create_table(
        'user_top_artists',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('spotify_artist_id', sa.String(255), nullable=False),
        sa.Column('artist_name', sa.String(500), nullable=False),
        sa.Column('genres', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('popularity', sa.Integer(), nullable=True),
        sa.Column('time_range', sa.String(20), nullable=False),
        sa.Column('rank', sa.Integer(), nullable=False),
        sa.Column('fetched_at', sa.DateTime(), nullable=False, default=sa.func.now()),
    )
    op.create_index('idx_top_artists_user_time', 'user_top_artists', ['user_id', 'time_range'])
    op.create_index('idx_top_artists_spotify_id', 'user_top_artists', ['spotify_artist_id'])

    op.create_table(
        'listening_history',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('spotify_track_id', sa.String(255), nullable=False),
        sa.Column('track_name', sa.String(500), nullable=False),
        sa.Column('artist_name', sa.String(500), nullable=False),
        sa.Column('album_name', sa.String(500), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('played_at', sa.DateTime(), nullable=False),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
    )
    op.create_index('idx_listening_user_played', 'listening_history', ['user_id', 'played_at'])
    op.create_index('idx_listening_spotify_id', 'listening_history', ['spotify_track_id'])

    op.create_table(
        'friendships',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('requester_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('receiver_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=sa.func.now()),
    )
    op.create_index('idx_friendships_requester', 'friendships', ['requester_id'])
    op.create_index('idx_friendships_receiver', 'friendships', ['receiver_id'])
    op.create_index('idx_friendships_status', 'friendships', ['status'])

    op.create_table(
        'notifications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(30), nullable=False),
        sa.Column('from_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=sa.func.now()),
    )
    op.create_index('idx_notifications_user', 'notifications', ['user_id'])
    op.create_index('idx_notifications_user_unread', 'notifications', ['user_id', 'is_read'])


def downgrade() -> None:
    op.drop_index('idx_notifications_user_unread', table_name='notifications')
    op.drop_index('idx_notifications_user', table_name='notifications')
    op.drop_table('notifications')

    op.drop_index('idx_friendships_status', table_name='friendships')
    op.drop_index('idx_friendships_receiver', table_name='friendships')
    op.drop_index('idx_friendships_requester', table_name='friendships')
    op.drop_table('friendships')

    op.drop_index('idx_listening_spotify_id', table_name='listening_history')
    op.drop_index('idx_listening_user_played', table_name='listening_history')
    op.drop_table('listening_history')

    op.drop_index('idx_top_artists_spotify_id', table_name='user_top_artists')
    op.drop_index('idx_top_artists_user_time', table_name='user_top_artists')
    op.drop_table('user_top_artists')

    op.drop_index('idx_top_tracks_spotify_id', table_name='user_top_tracks')
    op.drop_index('idx_top_tracks_user_time', table_name='user_top_tracks')
    op.drop_table('user_top_tracks')
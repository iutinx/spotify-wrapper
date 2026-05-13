"""Initial schema

Revision ID: 4dbcd5b12d2f
Revises: None
Create Date: 2026-05-13 01:18:17.642416

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


revision = '4dbcd5b12d2f'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    users = op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('spotify_id', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('email', sa.String(255), unique=True, nullable=True, index=True),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('profile_image_url', sa.String(500), nullable=True),
        sa.Column('spotify_access_token', sa.String(500), nullable=False),
        sa.Column('spotify_refresh_token', sa.String(500), nullable=True),
        sa.Column('spotify_token_expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=sa.func.now()),
        sa.Column('last_spotify_sync', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True, onupdate=sa.func.now()),
    )
    op.create_index('idx_users_spotify_id', 'users', ['spotify_id'])
    op.create_index('idx_users_email', 'users', ['email'])

    op.create_table(
        'user_profiles',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False, index=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('favorite_genres', sa.String(255), nullable=True),
        sa.Column('favorite_artists', sa.String(255), nullable=True),
        sa.Column('total_hours_listened', sa.Integer(), default=0),
        sa.Column('listening_streak', sa.Integer(), default=0),
        sa.Column('is_public', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, onupdate=sa.func.now()),
    )
    op.create_index('idx_user_profiles_user_id', 'user_profiles', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_user_profiles_user_id', table_name='user_profiles')
    op.drop_table('user_profiles')
    op.drop_index('idx_users_email', table_name='users')
    op.drop_index('idx_users_spotify_id', table_name='users')
    op.drop_table('users')
"""add profile handle, share_settings, avatar_url and user spotify_product

Revision ID: a1f7c2e9b30d
Revises: 3c8e9a2b1f4d
Create Date: 2026-06-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = 'a1f7c2e9b30d'
down_revision = '3c8e9a2b1f4d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # user_profiles: handle, avatar_url, share_settings
    op.add_column('user_profiles', sa.Column('handle', sa.String(30), nullable=True))
    op.add_column('user_profiles', sa.Column('avatar_url', sa.String(500), nullable=True))
    op.add_column('user_profiles', sa.Column('share_settings', JSONB(), nullable=True))
    op.create_index('idx_user_profiles_handle', 'user_profiles', ['handle'], unique=True)

    # users: spotify subscription tier
    op.add_column('users', sa.Column('spotify_product', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'spotify_product')

    op.drop_index('idx_user_profiles_handle', table_name='user_profiles')
    op.drop_column('user_profiles', 'share_settings')
    op.drop_column('user_profiles', 'avatar_url')
    op.drop_column('user_profiles', 'handle')

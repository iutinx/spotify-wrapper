"""add conversations and direct messages

Revision ID: b2f8d1c4e5a7
Revises: a1f7c2e9b30d
Create Date: 2026-06-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = 'b2f8d1c4e5a7'
down_revision = 'a1f7c2e9b30d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'conversations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user1_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user2_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('last_message_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('user1_id', 'user2_id', name='uq_conversations_users'),
    )
    op.create_index('idx_conversations_user1', 'conversations', ['user1_id'])
    op.create_index('idx_conversations_user2', 'conversations', ['user2_id'])
    op.create_index('idx_conversations_last_msg', 'conversations', ['last_message_at'])

    op.create_table(
        'direct_messages',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('conversation_id', UUID(as_uuid=True), sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_dm_conversation', 'direct_messages', ['conversation_id'])
    op.create_index('idx_dm_sender', 'direct_messages', ['sender_id'])
    op.create_index('idx_dm_conversation_created', 'direct_messages', ['conversation_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('idx_dm_conversation_created', table_name='direct_messages')
    op.drop_index('idx_dm_sender', table_name='direct_messages')
    op.drop_index('idx_dm_conversation', table_name='direct_messages')
    op.drop_table('direct_messages')

    op.drop_index('idx_conversations_last_msg', table_name='conversations')
    op.drop_index('idx_conversations_user2', table_name='conversations')
    op.drop_index('idx_conversations_user1', table_name='conversations')
    op.drop_table('conversations')

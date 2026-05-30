"""add_session_events_table

Revision ID: 7c8e7eae5943
Revises: a1b2c3d4e5f6
Create Date: 2026-05-26 23:30:09.275091

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '7c8e7eae5943'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('session_events',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('session_id', sa.Uuid(), nullable=False),
    sa.Column('sse_id', sa.Integer(), nullable=False),
    sa.Column('event_type', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
    sa.Column('event_data', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['advisory_sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_session_events_session_id'), 'session_events', ['session_id'], unique=False)
    op.create_index(op.f('ix_session_events_sse_id'), 'session_events', ['sse_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_session_events_sse_id'), table_name='session_events')
    op.drop_index(op.f('ix_session_events_session_id'), table_name='session_events')
    op.drop_table('session_events')

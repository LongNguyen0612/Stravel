"""b2b_session_status

Revision ID: b2b1c3d4e5f6
Revises: 7c8e7eae5943
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2b1c3d4e5f6"
down_revision: Union[str, None] = "7c8e7eae5943"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Drop the ENUM constraint by altering to VARCHAR (USING required for explicit cast)
    op.execute("ALTER TABLE advisory_sessions ALTER COLUMN status TYPE VARCHAR(20) USING status::text")
    # Step 2: Drop the old ENUM type
    op.execute("DROP TYPE IF EXISTS sessionstatus")
    # Step 3: Migrate existing data to B2B values
    op.execute("""
        UPDATE advisory_sessions SET status = CASE
            WHEN status = 'IN_PROGRESS' THEN 'pending'
            WHEN status = 'in_progress' THEN 'pending'
            WHEN status = 'COMPLETED' THEN 'confirmed'
            WHEN status = 'completed' THEN 'confirmed'
            WHEN status = 'ARCHIVED' THEN 'confirmed'
            WHEN status = 'archived' THEN 'confirmed'
            ELSE 'pending'
        END
    """)
    # Step 4: Add CHECK constraint (drop first to guard against re-run)
    op.execute("ALTER TABLE advisory_sessions DROP CONSTRAINT IF EXISTS advisory_sessions_status_check")
    op.execute("""
        ALTER TABLE advisory_sessions
        ADD CONSTRAINT advisory_sessions_status_check
        CHECK (status IN ('pending', 'confirmed', 'modified', 'flagged'))
    """)
    # Step 5: Set default
    op.execute("ALTER TABLE advisory_sessions ALTER COLUMN status SET DEFAULT 'pending'")
    # Step 6: Add flag_reason
    op.add_column("advisory_sessions", sa.Column("flag_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove flag_reason column
    op.drop_column("advisory_sessions", "flag_reason")
    # Remove CHECK constraint
    op.execute("ALTER TABLE advisory_sessions DROP CONSTRAINT IF EXISTS advisory_sessions_status_check")
    # Recreate the original ENUM type
    op.execute("CREATE TYPE sessionstatus AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ARCHIVED')")
    # Migrate data back
    op.execute("""
        UPDATE advisory_sessions SET status = CASE
            WHEN status = 'pending' THEN 'IN_PROGRESS'
            WHEN status = 'confirmed' THEN 'COMPLETED'
            WHEN status = 'modified' THEN 'COMPLETED'
            WHEN status = 'flagged' THEN 'IN_PROGRESS'
            ELSE 'IN_PROGRESS'
        END
    """)
    # Restore ENUM column type
    op.execute(
        "ALTER TABLE advisory_sessions ALTER COLUMN status TYPE sessionstatus USING status::sessionstatus"
    )
    op.execute("ALTER TABLE advisory_sessions ALTER COLUMN status SET DEFAULT 'IN_PROGRESS'::sessionstatus")

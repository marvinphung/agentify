from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models import Workspace


DEFAULT_WORKSPACE_ID = 1


def sync_workspace_sequence(db: Session) -> None:
    if db.bind and db.bind.dialect.name == "postgresql":
        db.execute(
            text(
                "SELECT setval(pg_get_serial_sequence('workspaces', 'id'), "
                "GREATEST((SELECT COALESCE(MAX(id), 1) FROM workspaces), 1), true)"
            )
        )


def ensure_default_workspace(db: Session) -> Workspace:
    workspace = db.get(Workspace, DEFAULT_WORKSPACE_ID)
    if workspace:
        sync_workspace_sequence(db)
        db.commit()
        return workspace
    workspace = Workspace(id=DEFAULT_WORKSPACE_ID, name="Demo Shop")
    db.add(workspace)
    db.commit()
    sync_workspace_sequence(db)
    db.commit()
    db.refresh(workspace)
    return workspace

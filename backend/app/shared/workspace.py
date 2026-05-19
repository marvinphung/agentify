from sqlalchemy.orm import Session

from app.models import Workspace


DEFAULT_WORKSPACE_ID = 1


def ensure_default_workspace(db: Session) -> Workspace:
    workspace = db.get(Workspace, DEFAULT_WORKSPACE_ID)
    if workspace:
        return workspace
    workspace = Workspace(id=DEFAULT_WORKSPACE_ID, name="Demo Shop")
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return workspace


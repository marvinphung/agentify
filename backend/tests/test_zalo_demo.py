from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.database import Base
from app.integrations.zalo.service import get_status, is_demo_connection, save_demo_connection


def test_save_demo_connection_marks_zalo_as_demo_connected() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as db:
        integration = save_demo_connection(db)
        db.commit()
        db.refresh(integration)

        assert integration.status == "demo"
        assert integration.oa_id == "demo-oa"
        assert integration.access_token is None
        assert is_demo_connection(db) is True
        assert get_status(db)["status"] == "demo"

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, ForeignKey, create_engine, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from app.config import settings
import ssl as ssl_module

Base = declarative_base()

# Lazy engine initialization
_engine = None
_SessionLocal = None


def _get_engine():
    """Create engine lazily, handling SSL for cloud databases."""
    global _engine
    if _engine is not None:
        return _engine

    url = settings.SQLALCHEMY_URL
    connect_args = {}

    # If URL has SSL params, configure properly
    if "ssl" in url.lower() or "tidb" in url.lower() or "4000" in url:
        try:
            ssl_context = ssl_module.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl_module.CERT_NONE
            connect_args["ssl"] = ssl_context
            # Remove ssl params from URL to avoid pymysql parsing issues
            url = url.split("?")[0] if "?" in url else url
        except Exception:
            pass

    _engine = create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=False,
        connect_args=connect_args,
    )
    return _engine


def _get_session_factory():
    global _SessionLocal
    if _SessionLocal is not None:
        return _SessionLocal
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_get_engine())
    return _SessionLocal


class Lander(Base):
    """Represents a lander from RedTrack. Each lander hosts a VSL."""
    __tablename__ = "landers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    redtrack_name = Column(String(500), nullable=False, unique=True, comment="Full lander name from RedTrack")
    vsl_id = Column(String(50), nullable=True, index=True, comment="Extracted VSL identifier (e.g. VSL 70)")
    product = Column(String(200), nullable=True, comment="Extracted product name")
    domain = Column(String(300), nullable=True, comment="Extracted domain")
    vturb_player_id = Column(String(100), nullable=True, comment="Mapped VTurb player ID")
    is_active = Column(Integer, default=1, comment="1=active (receiving data), 0=inactive")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LanderDailyStats(Base):
    """Daily financial stats per lander from RedTrack."""
    __tablename__ = "lander_daily_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lander_id = Column(Integer, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    revenue = Column(Float, default=0)
    cost = Column(Float, default=0)
    profit = Column(Float, default=0)
    clicks = Column(Integer, default=0)
    conversions = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    lp_views = Column(Integer, default=0)
    lp_clicks = Column(Integer, default=0)
    purchases = Column(Integer, default=0)
    initiate_checkouts = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("lander_id", "date", name="uq_lander_date"),
    )


class VturbDailyStats(Base):
    """Daily video stats per player from VTurb."""
    __tablename__ = "vturb_daily_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lander_id = Column(Integer, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    total_plays = Column(Integer, default=0)
    unique_plays = Column(Integer, default=0)
    watch_rate = Column(Float, default=0)
    avg_watch_time = Column(Integer, default=0, comment="Average watch time in seconds")
    retention_data = Column(Text, nullable=True, comment="JSON retention curve data")
    quartile_25 = Column(Integer, default=0)
    quartile_50 = Column(Integer, default=0)
    quartile_75 = Column(Integer, default=0)
    quartile_100 = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("lander_id", "date", name="uq_vturb_lander_date"),
    )


class ApiSettings(Base):
    """Key-value store for API settings."""
    __tablename__ = "api_settings_v2"

    id = Column(Integer, primary_key=True, autoincrement=True)
    setting_key = Column(String(100), nullable=False, unique=True)
    setting_value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SyncLog(Base):
    """Log of sync operations."""
    __tablename__ = "sync_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String(50), nullable=False)
    sync_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    date_from = Column(String(20), nullable=True)
    date_to = Column(String(20), nullable=True)
    records_processed = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class VslMapping(Base):
    """Manual mapping of lander to VTurb player."""
    __tablename__ = "vsl_mappings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lander_id = Column(Integer, nullable=False, index=True)
    vturb_player_id = Column(String(100), nullable=False)
    vturb_video_name = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    redtrack_name = Column(String(500), nullable=False)
    redtrack_offer_id = Column(String(100), nullable=True)
    vsl_id = Column(String(50), nullable=True, index=True)
    product = Column(String(200), nullable=True)
    vturb_player_id = Column(String(100), nullable=True, comment="Mapped VTurb player ID")
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OfferDailyStats(Base):
    __tablename__ = "offer_daily_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    revenue = Column(Float, default=0)
    cost = Column(Float, default=0)
    profit = Column(Float, default=0)
    clicks = Column(Integer, default=0)
    conversions = Column(Integer, default=0)
    purchases = Column(Integer, default=0)
    lp_views = Column(Integer, default=0)
    ic = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("offer_id", "date", name="uq_offer_daily"),
    )



def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=_get_engine())


def get_db():
    """Get a database session (generator for FastAPI dependency injection)."""
    db = _get_session_factory()()
    try:
        yield db
    finally:
        db.close()


def get_session():
    """Get a database session (non-generator)."""
    return _get_session_factory()()

"""
FastAPI API Routes

Provides REST endpoints for sync, settings, and data access.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

from app.services.sync_service import sync_redtrack, sync_vturb, sync_offers, sync_all, get_setting, set_setting
from app.services.redtrack import test_connection as test_redtrack
from app.services.vturb import test_connection as test_vturb
from app.services.dashboard_queries import (
    get_overview, get_vsl_ranking, get_lander_ranking,
    get_daily_performance, get_available_vsls, get_sync_history,
)

router = APIRouter(prefix="/api", tags=["api"])


class SettingRequest(BaseModel):
    key: str
    value: str
    description: Optional[str] = None


class SyncRequest(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None


@router.post("/settings")
async def save_setting(req: SettingRequest):
    try:
        set_setting(req.key, req.value, req.description)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/{key}")
async def read_setting(key: str):
    value = get_setting(key)
    if value is None:
        return {"key": key, "value": None}
    # Mask the value for display
    masked = value[:3] + "***" + value[-4:] if len(value) > 7 else "***"
    return {"key": key, "value": masked, "has_value": True}


@router.post("/test/redtrack")
async def test_redtrack_connection():
    api_key = get_setting("redtrack_api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="RedTrack API key not configured")
    try:
        result = await test_redtrack(api_key)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test/vturb")
async def test_vturb_connection():
    api_token = get_setting("vturb_api_token")
    if not api_token:
        raise HTTPException(status_code=400, detail="VTurb API token not configured")
    try:
        result = await test_vturb(api_token)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/redtrack")
async def sync_redtrack_data(req: SyncRequest):
    date_to = req.date_to or datetime.now().strftime("%Y-%m-%d")
    date_from = req.date_from or (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    result = await sync_redtrack(date_from, date_to)
    return result


@router.post("/sync/vturb")
async def sync_vturb_data(req: SyncRequest):
    date_to = req.date_to or datetime.now().strftime("%Y-%m-%d")
    date_from = req.date_from or (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    result = await sync_vturb(date_from, date_to)
    return result


@router.post("/sync/all")
async def sync_all_data(req: SyncRequest):
    date_to = req.date_to or datetime.now().strftime("%Y-%m-%d")
    date_from = req.date_from or (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    result = await sync_all(date_from, date_to)
    return result


@router.get("/overview")
async def overview(period: str = "30D"):
    return get_overview(period)


@router.get("/ranking/vsl")
async def vsl_ranking(
    period: str = "30D",
    sort_by: str = "cost",
    sort_dir: str = "desc",
    only_vsl: bool = True,
):
    df = get_vsl_ranking(period, sort_by, sort_dir, only_vsl)
    return df.to_dict("records") if not df.empty else []


@router.get("/ranking/lander")
async def lander_ranking(
    period: str = "30D",
    vsl_filter: Optional[str] = None,
    sort_by: str = "cost",
    sort_dir: str = "desc",
):
    df = get_lander_ranking(period, vsl_filter, sort_by, sort_dir)
    return df.to_dict("records") if not df.empty else []


@router.get("/performance/daily")
async def daily_performance(period: str = "30D", vsl_filter: Optional[str] = None):
    df = get_daily_performance(period, vsl_filter)
    return df.to_dict("records") if not df.empty else []


@router.get("/vsls")
async def available_vsls():
    return get_available_vsls()


@router.get("/sync/history")
async def sync_history():
    return get_sync_history()

@router.get("/landers/with-vsl")
async def landers_with_vsl():
    """Get all landers that have a VSL id, for mapping."""
    from app.models.database import Lander, get_session
    session = get_session()
    try:
        rows = session.query(Lander).filter(
            Lander.vsl_id.isnot(None),
            Lander.is_active == 1,
        ).order_by(Lander.vsl_id).all()
        return [
            {
                "id": r.id,
                "redtrack_name": r.redtrack_name,
                "vsl_id": r.vsl_id,
                "product": r.product,
                "vturb_player_id": r.vturb_player_id or "",
            }
            for r in rows
        ]
    finally:
        session.close()


@router.post("/landers/{lander_id}/map-vturb")
async def map_vturb_player(lander_id: int, req: SettingRequest):
    """Map a VTurb player_id to a lander or offer."""
    from app.models.database import Lander, Offer, get_session
    session = get_session()
    try:
        if lander_id < 0:
            # Negative ID = offer
            record = session.query(Offer).filter_by(id=abs(lander_id)).first()
            if not record:
                raise HTTPException(status_code=404, detail="Offer not found")
        else:
            record = session.query(Lander).filter_by(id=lander_id).first()
            if not record:
                raise HTTPException(status_code=404, detail="Lander not found")

        record.vturb_player_id = req.value
        session.commit()
        return {"success": True, "id": lander_id, "vturb_player_id": req.value}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@router.post("/sync/offers")
async def sync_offers_data(req: SyncRequest):
    date_to = req.date_to or datetime.now().strftime("%Y-%m-%d")
    date_from = req.date_from or (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    result = await sync_offers(date_from, date_to)
    return result

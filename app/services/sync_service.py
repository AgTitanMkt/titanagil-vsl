"""
Sync Service

Orchestrates data synchronization from RedTrack and VTurb.
Optimized: minimal API requests, bulk database operations.
"""
import json
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.database import (
    Lander, LanderDailyStats, VturbDailyStats,
    Offer, OfferDailyStats,
    ApiSettings, SyncLog, get_session,
)


from app.services.redtrack import fetch_lander_report, fetch_offer_report
from app.services.vturb import fetch_player_stats, fetch_player_stats_by_day, fetch_player_retention, fetch_player_totals
from app.services.vsl_normalizer import (
    extract_vsl_id, extract_product_from_lander,
    extract_domain_from_lander, is_lander_active,
)


def get_setting(key: str) -> Optional[str]:
    """Get a setting value from the database."""
    session = get_session()
    try:
        row = session.query(ApiSettings).filter_by(setting_key=key).first()
        return row.setting_value if row else None
    finally:
        session.close()


def set_setting(key: str, value: str, description: str = None):
    """Set a setting value in the database."""
    session = get_session()
    try:
        row = session.query(ApiSettings).filter_by(setting_key=key).first()
        if row:
            row.setting_value = value
            if description:
                row.description = description
            row.updated_at = datetime.utcnow()
        else:
            row = ApiSettings(
                setting_key=key,
                setting_value=value,
                description=description,
            )
            session.add(row)
        session.commit()
    finally:
        session.close()


def _get_or_create_lander(session: Session, redtrack_name: str, row: dict) -> Lander:
    """Get or create a lander record."""
    lander = session.query(Lander).filter_by(redtrack_name=redtrack_name).first()
    if lander:
        if is_lander_active(row):
            lander.is_active = 1
        lander.updated_at = datetime.utcnow()
        return lander

    vsl_id = extract_vsl_id(redtrack_name)
    product = extract_product_from_lander(redtrack_name)
    domain = extract_domain_from_lander(redtrack_name)

    lander = Lander(
        redtrack_name=redtrack_name,
        vsl_id=vsl_id,
        product=product,
        domain=domain,
        is_active=1 if is_lander_active(row) else 0,
    )
    session.add(lander)
    session.flush()
    return lander


def _upsert_daily_stats(session: Session, lander_id: int, stat_date: date, row: dict):
    """Insert or update daily stats for a lander."""
    existing = session.query(LanderDailyStats).filter_by(
        lander_id=lander_id, date=stat_date
    ).first()

    revenue = float(row.get("revenue", 0) or 0)
    cost = float(row.get("cost", 0) or 0)
    profit = float(row.get("profit", 0) or 0)
    clicks = int(row.get("clicks", 0) or 0)
    conversions = int(row.get("conversions", 0) or row.get("total_conversions", 0) or 0)
    impressions = int(row.get("impressions", 0) or row.get("imp", 0) or 0)
    lp_views = int(row.get("lp_views", 0) or row.get("lpviews", 0) or 0)
    lp_clicks = int(row.get("lp_clicks", 0) or row.get("lpclicks", 0) or 0)
    purchases = int(row.get("purchases", 0) or row.get("sales", 0) or row.get("tr", 0) or 0)
    if purchases == 0:
        purchases = conversions
    initiate_checkouts = int(row.get("initiate_checkouts", 0) or row.get("ic", 0) or 0)

    if existing:
        existing.revenue = revenue
        existing.cost = cost
        existing.profit = profit
        existing.clicks = clicks
        existing.conversions = conversions
        existing.impressions = impressions
        existing.lp_views = lp_views or clicks
        existing.lp_clicks = lp_clicks
        existing.purchases = purchases
        existing.initiate_checkouts = initiate_checkouts
    else:
        stats = LanderDailyStats(
            lander_id=lander_id,
            date=stat_date,
            revenue=revenue,
            cost=cost,
            profit=profit,
            clicks=clicks,
            conversions=conversions,
            impressions=impressions,
            lp_views=lp_views or clicks,
            lp_clicks=lp_clicks,
            purchases=purchases,
            initiate_checkouts=initiate_checkouts,
        )
        session.add(stats)


async def sync_redtrack(date_from: str, date_to: str) -> Dict[str, Any]:
    """
    Sync RedTrack lander data.
    Uses group=landing (no date field in response).
    When date_from == date_to: saves as that single date.
    When range > 1 day: saves as date_to (aggregated totals for the period).
    """
    api_key = get_setting("redtrack_api_key")
    if not api_key:
        return {"success": False, "error": "RedTrack API key not configured", "records": 0}

    session = get_session()
    log = SyncLog(
        source="redtrack", sync_type="lander_report",
        status="running", date_from=date_from, date_to=date_to,
    )
    session.add(log)
    session.commit()

    try:
        rows = await fetch_lander_report(api_key, date_from, date_to)
        records = 0

        # Use date_from as the stat date (since group=landing has no date field)
        # For single day sync, this is the correct date
        # For range sync, we use date_to as the reference date
        if date_from == date_to:
            stat_date = datetime.strptime(date_from, "%Y-%m-%d").date()
        else:
            stat_date = datetime.strptime(date_to, "%Y-%m-%d").date()

        for row in rows:
            lander_name = row.get("landing", "") or ""

            # Skip empty/unknown landers
            if not lander_name or lander_name.strip() == "":
                continue

            # Only process active landers (with actual data)
            if not is_lander_active(row):
                continue

            lander = _get_or_create_lander(session, lander_name, row)
            _upsert_daily_stats(session, lander.id, stat_date, row)
            records += 1

        session.commit()

        log.status = "success"
        log.records_processed = records
        log.completed_at = datetime.utcnow()
        session.commit()

        return {"success": True, "records": records}

    except Exception as e:
        session.rollback()
        log.status = "error"
        log.error_message = str(e)
        log.completed_at = datetime.utcnow()
        session.commit()
        return {"success": False, "error": str(e), "records": 0}
    finally:
        session.close()


async def sync_vturb(date_from: str, date_to: str) -> Dict[str, Any]:
    """
    Sync VTurb video data.
    Only fetches data for landers that have a VTurb player mapped.
    """
    api_token = get_setting("vturb_api_token")
    if not api_token:
        return {"success": False, "error": "VTurb API token not configured", "records": 0}

    session = get_session()
    log = SyncLog(
        source="vturb", sync_type="player_stats",
        status="running", date_from=date_from, date_to=date_to,
    )
    session.add(log)
    session.commit()

    try:
        # Get landers with VTurb player mapped
        mapped_landers = session.query(Lander).filter(
            Lander.vturb_player_id.isnot(None),
            Lander.vturb_player_id != "",
        ).all()

        records = 0

        # Group by player_id to avoid duplicate API calls
        player_landers = {}
        for lander in mapped_landers:
            pid = lander.vturb_player_id
            if pid not in player_landers:
                player_landers[pid] = []
            player_landers[pid].append(lander)

        for player_id, landers in player_landers.items():
            try:
                # Fetch daily stats for this player
                daily_data = await fetch_player_stats_by_day(
                    api_token, player_id, date_from, date_to
                )

                for day_data in daily_data:
                    day = day_data.get("day")
                    if not day:
                        continue

                    parsed_date = datetime.strptime(day, "%Y-%m-%d").date()
                    started = int(day_data.get("started", 0))
                    finished = int(day_data.get("finished", 0))
                    viewed = int(day_data.get("viewed", 0))

                    # Calculate rates
                    watch_rate = round((finished / started * 100), 2) if started > 0 else 0
                    hook_rate = round((started / viewed * 100), 2) if viewed > 0 else 0

                    # Save for each lander with this player
                    for lander in landers:
                        existing = session.query(VturbDailyStats).filter_by(
                            lander_id=lander.id, date=parsed_date
                        ).first()

                        if existing:
                            existing.total_plays = started
                            existing.unique_plays = int(day_data.get("viewed", 0))
                            existing.watch_rate = watch_rate
                        else:
                            vturb_stat = VturbDailyStats(
                                lander_id=lander.id,
                                date=parsed_date,
                                total_plays=started,
                                unique_plays=viewed,
                                watch_rate=watch_rate,
                            )
                            session.add(vturb_stat)
                        records += 1

                # Try retention data (may be empty if not configured in VTurb)
                try:
                    retention = await fetch_player_retention(
                        api_token, player_id, date_from, date_to
                    )
                    retention_data = retention.get("grouped_timed", [])
                    if retention_data and len(retention_data) > 0:
                        for lander in landers:
                            first_stat = session.query(VturbDailyStats).filter_by(
                                lander_id=lander.id
                            ).order_by(VturbDailyStats.date.desc()).first()

                            if first_stat:
                                first_stat.retention_data = json.dumps(retention_data)
                                total_seconds = len(retention_data)
                                idx_25 = min(int(total_seconds * 0.25), total_seconds - 1)
                                idx_50 = min(int(total_seconds * 0.5), total_seconds - 1)
                                idx_75 = min(int(total_seconds * 0.75), total_seconds - 1)
                                first_stat.quartile_25 = retention_data[idx_25].get("total", 0)
                                first_stat.quartile_50 = retention_data[idx_50].get("total", 0)
                                first_stat.quartile_75 = retention_data[idx_75].get("total", 0)
                                first_stat.quartile_100 = retention_data[-1].get("total", 0)
                except Exception as e:
                    print(f"[VTurb] Retention error for {player_id}: {e}")

            except Exception as e:
                print(f"[VTurb] Error for player {player_id}: {e}")

        session.commit()

        log.status = "success"
        log.records_processed = records
        log.completed_at = datetime.utcnow()
        session.commit()

        return {"success": True, "records": records}

    except Exception as e:
        session.rollback()
        log.status = "error"
        log.error_message = str(e)
        log.completed_at = datetime.utcnow()
        session.commit()
        return {"success": False, "error": str(e), "records": 0}
    finally:
        session.close()

async def sync_offers(date_from: str, date_to: str) -> Dict[str, Any]:
    """Sync offer data from RedTrack."""
    import re
    
    api_key = get_setting("redtrack_api_key")
    if not api_key:
        return {"success": False, "error": "RedTrack API key not configured", "records": 0}
    
    session = get_session()
    log = SyncLog(
        source="redtrack_offers",
        sync_type="offer_report",
        status="running",
        date_from=date_from,
        date_to=date_to,
    )
    session.add(log)
    session.commit()

    try:
        data = await fetch_offer_report(
            api_key=api_key,
            date_from=date_from,
            date_to=date_to,
        )

        vsl_pattern = re.compile(r'VSL[\s]*(\d+[\.\d\w]*)', re.IGNORECASE)
        product_keywords = [
            "Vitalpro", "VitalPro", "Vigorox", "VIGOROX", "FocusMax", "FOCUSMAX",
            "Mindboost", "MindBoost", "MINDBOOST", "SteelPower", "STEELPOWER",
            "LipoRise", "LIPORISE", "LipoJaro", "Glycopezil", "GLYCOPEZIL",
            "GlycoCare", "MemoPezil", "MEMOPEZIL", "Neurodyne", "SonusZen",
            "LeanRise", "LEANRISE", "VapoFil", "PrimePulse", "ProstateMax",
            "EreForce", "EREFORCE", "GlucoSense", "GLUCOSENSE", "MemoryLift",
            "MEMORYLIFT",
        ]

        records = 0

        # Determinar stat_date (mesmo padrão do sync_redtrack)
        if date_from == date_to:
            stat_date = datetime.strptime(date_from, "%Y-%m-%d").date()
        else:
            stat_date = datetime.strptime(date_to, "%Y-%m-%d").date()

        for row in data:
            offer_name = row.get("offer", "")
            offer_id = str(row.get("offer_id", ""))

            if not offer_name:
                continue

            # Extract VSL
            vsl_match = vsl_pattern.search(offer_name)
            vsl_id = f"VSL {vsl_match.group(1)}" if vsl_match else None

            # Extract product
            product = None
            for kw in product_keywords:
                if kw.lower() in offer_name.lower():
                    product = kw
                    break

            # Upsert offer
            existing = session.query(Offer).filter_by(redtrack_name=offer_name).first()
            if existing:
                existing.vsl_id = vsl_id
                existing.product = product
                existing.redtrack_offer_id = offer_id
                existing.is_active = 1
                existing.updated_at = datetime.utcnow()
                offer_obj = existing
            else:
                offer_obj = Offer(
                    redtrack_name=offer_name,
                    redtrack_offer_id=offer_id,
                    vsl_id=vsl_id,
                    product=product,
                    is_active=1,
                )
                session.add(offer_obj)
                session.flush()

            # Upsert daily stats
            existing_stats = session.query(OfferDailyStats).filter_by(
                offer_id=offer_obj.id, date=stat_date
            ).first()

            revenue = float(row.get("revenue", 0) or 0)
            cost = float(row.get("cost", 0) or 0)
            profit = float(row.get("profit", 0) or 0)
            clicks = int(row.get("clicks", 0) or 0)
            conversions = int(row.get("conversions", 0) or row.get("total_conversions", 0) or 0)
            purchases = int(row.get("purchases", 0) or row.get("sales", 0) or row.get("tr", 0) or 0)
            if purchases == 0:
                purchases = conversions
            lp_views = int(row.get("lp_views", 0) or row.get("lpviews", 0) or 0)
            ic = int(row.get("initiate_checkouts", 0) or row.get("ic", 0) or 0)

            if existing_stats:
                existing_stats.revenue = revenue
                existing_stats.cost = cost
                existing_stats.profit = profit
                existing_stats.clicks = clicks
                existing_stats.conversions = conversions
                existing_stats.purchases = purchases
                existing_stats.lp_views = lp_views
                existing_stats.ic = ic
                existing_stats.updated_at = datetime.utcnow()
            else:
                stats = OfferDailyStats(
                    offer_id=offer_obj.id,
                    date=stat_date,
                    revenue=revenue,
                    cost=cost,
                    profit=profit,
                    clicks=clicks,
                    conversions=conversions,
                    purchases=purchases,
                    lp_views=lp_views,
                    ic=ic,
                )
                session.add(stats)

            records += 1

        session.commit()

        log.status = "success"
        log.records_processed = records
        log.completed_at = datetime.utcnow()
        session.commit()

        return {"success": True, "records": records}

    except Exception as e:
        session.rollback()
        log.status = "error"
        log.error_message = str(e)
        log.completed_at = datetime.utcnow()
        session.commit()
        return {"success": False, "error": str(e), "records": 0}
    finally:
        session.close()

async def sync_all(date_from: str, date_to: str) -> Dict[str, Any]:
    """Sync RedTrack (landers + offers) and VTurb data."""
    rt = await sync_redtrack(date_from, date_to)
    of = await sync_offers(date_from, date_to)
    vt = await sync_vturb(date_from, date_to)
    return {"redtrack": rt, "offers": of, "vturb": vt}



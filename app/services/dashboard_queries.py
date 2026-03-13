"""
Dashboard Queries

Optimized SQL queries for dashboard data.
All queries use SQLAlchemy for safety and performance.
"""
import pandas as pd
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import func, case, and_, or_, text
from sqlalchemy.orm import Session

from app.models.database import (
    Lander, LanderDailyStats, VturbDailyStats, SyncLog, get_session, Offer, OfferDailyStats
)


def parse_custom_date_range(date_from_str: str, date_to_str: str) -> Tuple[date, date]:
    """Parse custom date range strings."""
    try:
        d_from = datetime.strptime(date_from_str, "%Y-%m-%d").date()
        d_to = datetime.strptime(date_to_str, "%Y-%m-%d").date()
        return d_from, d_to
    except (ValueError, TypeError):
        return get_date_range("30D")

def get_date_range(period: str) -> Tuple[date, date]:
    """Convert period string to date range."""
    today = date.today()
    if period == "1D":
        return today, today
    elif period == "3D":
        return today - timedelta(days=2), today
    elif period == "7D":
        return today - timedelta(days=6), today
    elif period == "14D":
        return today - timedelta(days=13), today
    elif period == "30D":
        return today - timedelta(days=29), today
    elif period == "45D":
        return today - timedelta(days=44), today
    elif period == "60D":
        return today - timedelta(days=59), today
    elif period == "90D":
        return today - timedelta(days=89), today
    else:
        return date(2020, 1, 1), today



def get_previous_date_range(period: str) -> Tuple[date, date]:
    """Get the previous period for comparison."""
    today = date.today()
    if period == "1D":
        yesterday = today - timedelta(days=1)
        return yesterday, yesterday
    elif period == "3D":
        return today - timedelta(days=5), today - timedelta(days=3)
    elif period == "7D":
        return today - timedelta(days=13), today - timedelta(days=7)
    elif period == "14D":
        return today - timedelta(days=27), today - timedelta(days=14)
    elif period == "30D":
        return today - timedelta(days=59), today - timedelta(days=30)
    elif period == "45D":
        return today - timedelta(days=89), today - timedelta(days=45)
    elif period == "60D":
        return today - timedelta(days=119), today - timedelta(days=60)
    else:
        return date(2020, 1, 1), date(2020, 1, 1)


def get_overview(period: str = "30D") -> Dict[str, Any]:
    """Get overview metrics for the dashboard. Includes landers + offers."""
    session = get_session()
    try:
        date_from, date_to = get_date_range(period)
        prev_from, prev_to = get_previous_date_range(period)

        # Current period - LANDERS
        current = session.query(
            func.sum(LanderDailyStats.revenue).label("revenue"),
            func.sum(LanderDailyStats.cost).label("cost"),
            func.sum(LanderDailyStats.profit).label("profit"),
            func.sum(LanderDailyStats.clicks).label("clicks"),
            func.sum(LanderDailyStats.purchases).label("purchases"),
            func.sum(LanderDailyStats.lp_views).label("lp_views"),
        ).join(
            Lander, Lander.id == LanderDailyStats.lander_id
        ).filter(
            LanderDailyStats.date.between(date_from, date_to),
            Lander.is_active == 1,
        ).first()

        # Current period - OFFERS
        current_offers = session.query(
            func.sum(OfferDailyStats.revenue).label("revenue"),
            func.sum(OfferDailyStats.cost).label("cost"),
            func.sum(OfferDailyStats.profit).label("profit"),
            func.sum(OfferDailyStats.clicks).label("clicks"),
            func.sum(OfferDailyStats.purchases).label("purchases"),
            func.sum(OfferDailyStats.lp_views).label("lp_views"),
        ).join(
            Offer, Offer.id == OfferDailyStats.offer_id
        ).filter(
            OfferDailyStats.date.between(date_from, date_to),
            Offer.is_active == 1,
        ).first()

        # Previous period - LANDERS
        previous = session.query(
            func.sum(LanderDailyStats.revenue).label("revenue"),
            func.sum(LanderDailyStats.cost).label("cost"),
            func.sum(LanderDailyStats.profit).label("profit"),
        ).join(
            Lander, Lander.id == LanderDailyStats.lander_id
        ).filter(
            LanderDailyStats.date.between(prev_from, prev_to),
            Lander.is_active == 1,
        ).first()

        # Previous period - OFFERS
        previous_offers = session.query(
            func.sum(OfferDailyStats.revenue).label("revenue"),
            func.sum(OfferDailyStats.cost).label("cost"),
            func.sum(OfferDailyStats.profit).label("profit"),
        ).join(
            Offer, Offer.id == OfferDailyStats.offer_id
        ).filter(
            OfferDailyStats.date.between(prev_from, prev_to),
            Offer.is_active == 1,
        ).first()

        # VTurb totals
        vturb = session.query(
            func.sum(VturbDailyStats.total_plays).label("plays"),
            func.sum(VturbDailyStats.unique_plays).label("unique_plays"),
            func.avg(VturbDailyStats.watch_rate).label("watch_rate"),
        ).join(
            Lander, Lander.id == VturbDailyStats.lander_id
        ).filter(
            VturbDailyStats.date.between(date_from, date_to),
            Lander.is_active == 1,
        ).first()

        # Sum landers + offers
        revenue = float(current.revenue or 0) + float(current_offers.revenue or 0 if current_offers else 0)
        cost = float(current.cost or 0) + float(current_offers.cost or 0 if current_offers else 0)
        profit = float(current.profit or 0) + float(current_offers.profit or 0 if current_offers else 0)
        clicks = int(current.clicks or 0) + int(current_offers.clicks or 0 if current_offers else 0)
        purchases = int(current.purchases or 0) + int(current_offers.purchases or 0 if current_offers else 0)
        lp_views = int(current.lp_views or 0) + int(current_offers.lp_views or 0 if current_offers else 0)

        prev_revenue = float(previous.revenue or 0 if previous else 0) + float(previous_offers.revenue or 0 if previous_offers else 0)
        prev_cost = float(previous.cost or 0 if previous else 0) + float(previous_offers.cost or 0 if previous_offers else 0)
        prev_profit = float(previous.profit or 0 if previous else 0) + float(previous_offers.profit or 0 if previous_offers else 0)

        roi = (profit / cost * 100) if cost > 0 else 0
        epc = (revenue / clicks) if clicks > 0 else 0
        conv_rate = (purchases / lp_views * 100) if lp_views > 0 else 0

        def pct_change(current_val, prev_val):
            if prev_val == 0:
                return 100.0 if current_val > 0 else 0.0
            return ((current_val - prev_val) / abs(prev_val)) * 100

        return {
            "revenue": revenue,
            "cost": cost,
            "profit": profit,
            "roi": round(roi, 1),
            "epc": round(epc, 2),
            "purchases": purchases,
            "clicks": clicks,
            "lp_views": lp_views,
            "conv_rate": round(conv_rate, 1),
            "plays": int(vturb.plays or 0) if vturb else 0,
            "watch_rate": round(float(vturb.watch_rate or 0), 1) if vturb else 0,
            "revenue_change": round(pct_change(revenue, prev_revenue), 1),
            "cost_change": round(pct_change(cost, prev_cost), 1),
            "profit_change": round(pct_change(profit, prev_profit), 1),
        }
    finally:
        session.close()


def get_vsl_ranking(
    period: str = "30D",
    sort_by: str = "cost",
    sort_dir: str = "desc",
    only_with_vsl: bool = True,
    date_from_str: str = None,
    date_to_str: str = None,
    vsl_filter: str = None,
) -> pd.DataFrame:
    """
    Get VSL ranking grouped by VSL ID.
    Aggregates all landers + offers that share the same VSL.
    Includes VTurb metrics (plays, watch rate, hook rate, body rate).
    """
    session = get_session()
    try:
        if date_from_str and date_to_str:
            date_from, date_to = parse_custom_date_range(date_from_str, date_to_str)
        else:
            date_from, date_to = get_date_range(period)

        # RedTrack LANDER query: aggregate by VSL ID
        query = session.query(
            Lander.vsl_id,
            func.group_concat(Lander.redtrack_name.distinct()).label("landers"),
            func.min(Lander.product).label("product"),
            func.sum(LanderDailyStats.revenue).label("revenue"),
            func.sum(LanderDailyStats.cost).label("cost"),
            func.sum(LanderDailyStats.profit).label("profit"),
            func.sum(LanderDailyStats.clicks).label("clicks"),
            func.sum(LanderDailyStats.purchases).label("purchases"),
            func.sum(LanderDailyStats.lp_views).label("lp_views"),
            func.sum(LanderDailyStats.conversions).label("conversions"),
            func.count(Lander.id.distinct()).label("lander_count"),
        ).join(
            LanderDailyStats, Lander.id == LanderDailyStats.lander_id
        ).filter(
            LanderDailyStats.date.between(date_from, date_to),
            Lander.is_active == 1,
        )

        if only_with_vsl:
            query = query.filter(Lander.vsl_id.isnot(None))

        if vsl_filter:
            query = query.filter(Lander.vsl_id == vsl_filter)

        query = query.group_by(Lander.vsl_id)
        rows = query.all()

        # VTurb query: get totals per VSL
        vturb_query = session.query(
            Lander.vsl_id,
            func.sum(VturbDailyStats.total_plays).label("plays"),
            func.sum(VturbDailyStats.unique_plays).label("viewed"),
            func.avg(VturbDailyStats.watch_rate).label("watch_rate"),
        ).join(
            VturbDailyStats, Lander.id == VturbDailyStats.lander_id
        ).filter(
            VturbDailyStats.date.between(date_from, date_to),
            Lander.is_active == 1,
        ).group_by(Lander.vsl_id).all()

        vturb_map = {}
        for vt in vturb_query:
            vturb_map[vt.vsl_id] = {
                "plays": int(vt.plays or 0),
                "viewed": int(vt.viewed or 0),
                "watch_rate": round(float(vt.watch_rate or 0), 2),
            }

        # Offers query (ClickBank): aggregate by VSL ID
        offer_query = session.query(
            Offer.vsl_id,
            func.group_concat(Offer.redtrack_name.distinct()).label("offer_names"),
            func.min(Offer.product).label("product"),
            func.sum(OfferDailyStats.revenue).label("revenue"),
            func.sum(OfferDailyStats.cost).label("cost"),
            func.sum(OfferDailyStats.profit).label("profit"),
            func.sum(OfferDailyStats.clicks).label("clicks"),
            func.sum(OfferDailyStats.purchases).label("purchases"),
            func.sum(OfferDailyStats.lp_views).label("lp_views"),
            func.sum(OfferDailyStats.conversions).label("conversions"),
            func.count(Offer.id.distinct()).label("offer_count"),
        ).join(
            OfferDailyStats, Offer.id == OfferDailyStats.offer_id
        ).filter(
            OfferDailyStats.date.between(date_from, date_to),
            Offer.is_active == 1,
            Offer.vsl_id.isnot(None),
        )

        if vsl_filter:
            offer_query = offer_query.filter(Offer.vsl_id == vsl_filter)

        offer_query = offer_query.group_by(Offer.vsl_id)
        offer_rows = offer_query.all()

        # Build offers lookup
        offer_map = {}
        for of in offer_rows:
            offer_map[of.vsl_id] = {
                "revenue": float(of.revenue or 0),
                "cost": float(of.cost or 0),
                "profit": float(of.profit or 0),
                "clicks": int(of.clicks or 0),
                "purchases": int(of.purchases or 0),
                "lp_views": int(of.lp_views or 0),
                "offer_names": of.offer_names or "",
                "offer_count": int(of.offer_count or 0),
                "product": of.product or "",
            }

        # Track which VSL IDs we've already processed
        processed_vsls = set()

        data = []
        for row in rows:
            processed_vsls.add(row.vsl_id)

            # Lander data (Cartpanda)
            revenue = float(row.revenue or 0)
            cost = float(row.cost or 0)
            profit = float(row.profit or 0)
            clicks = int(row.clicks or 0)
            purchases = int(row.purchases or 0)
            lp_views = int(row.lp_views or 0)
            lander_count = int(row.lander_count or 0)

            # Add offer data (ClickBank)
            of_data = offer_map.get(row.vsl_id, {})
            revenue += of_data.get("revenue", 0)
            cost += of_data.get("cost", 0)
            profit += of_data.get("profit", 0)
            clicks += of_data.get("clicks", 0)
            purchases += of_data.get("purchases", 0)
            lp_views += of_data.get("lp_views", 0)
            total_count = lander_count + of_data.get("offer_count", 0)

            # Combine lander names + offer names
            landers_list = row.landers.split(",") if row.landers else []
            offer_names = of_data.get("offer_names", "").split(",") if of_data.get("offer_names") else []
            all_names = landers_list + offer_names

            roi = (profit / cost * 100) if cost > 0 else 0
            epc = (revenue / clicks) if clicks > 0 else 0
            conv_rate = (purchases / lp_views * 100) if lp_views > 0 else 0

            # VTurb data
            vt = vturb_map.get(row.vsl_id, {})
            plays = vt.get("plays", 0)
            viewed = vt.get("viewed", 0)
            watch_rate = vt.get("watch_rate", 0)
            hook_rate = round((plays / viewed * 100), 2) if viewed > 0 else 0
            body_rate = round((watch_rate / hook_rate * 100), 2) if hook_rate > 0 and watch_rate > 0 else 0

            data.append({
                "vsl_id": row.vsl_id or "Sem VSL",
                "product": row.product or of_data.get("product", ""),
                "landers": all_names,
                "lander_count": total_count,
                "revenue": round(revenue, 2),
                "cost": round(cost, 2),
                "profit": round(profit, 2),
                "roi": round(roi, 1),
                "epc": round(epc, 2),
                "clicks": clicks,
                "purchases": purchases,
                "lp_views": lp_views,
                "conv_rate": round(conv_rate, 1),
                "plays": plays,
                "viewed": viewed,
                "watch_rate": watch_rate,
                "hook_rate": hook_rate,
                "body_rate": body_rate,
            })

        # Add VSLs that ONLY exist in offers (no landers)
        for vsl_id, of_data in offer_map.items():
            if vsl_id in processed_vsls:
                continue

            revenue = of_data.get("revenue", 0)
            cost = of_data.get("cost", 0)
            profit = of_data.get("profit", 0)
            clicks = of_data.get("clicks", 0)
            purchases = of_data.get("purchases", 0)
            lp_views = of_data.get("lp_views", 0)

            roi = (profit / cost * 100) if cost > 0 else 0
            epc = (revenue / clicks) if clicks > 0 else 0
            conv_rate = (purchases / lp_views * 100) if lp_views > 0 else 0

            offer_names = of_data.get("offer_names", "").split(",") if of_data.get("offer_names") else []

            data.append({
                "vsl_id": vsl_id or "Sem VSL",
                "product": of_data.get("product", ""),
                "landers": offer_names,
                "lander_count": of_data.get("offer_count", 0),
                "revenue": round(revenue, 2),
                "cost": round(cost, 2),
                "profit": round(profit, 2),
                "roi": round(roi, 1),
                "epc": round(epc, 2),
                "clicks": clicks,
                "purchases": purchases,
                "lp_views": lp_views,
                "conv_rate": round(conv_rate, 1),
                "plays": 0,
                "viewed": 0,
                "watch_rate": 0,
                "hook_rate": 0,
                "body_rate": 0,
            })

        df = pd.DataFrame(data)
        if df.empty:
            return df

        ascending = sort_dir == "asc"
        if sort_by in df.columns:
            df = df.sort_values(sort_by, ascending=ascending)

        return df.reset_index(drop=True)
    finally:
        session.close()


def get_vsl_ranking_by_lander(
    period: str = "30D",
    sort_by: str = "cost",
    sort_dir: str = "desc",
    only_with_vsl: bool = True,
    date_from_str: str = None,
    date_to_str: str = None,
    vsl_filter: str = None,
) -> pd.DataFrame:
    """
    Get VSL ranking showing each lander AND offer individually.
    Landers (Cartpanda) + Offers (ClickBank) appear as separate rows.
    """
    session = get_session()
    try:
        if date_from_str and date_to_str:
            date_from, date_to = parse_custom_date_range(date_from_str, date_to_str)
        else:
            date_from, date_to = get_date_range(period)

        # === LANDERS (Cartpanda) ===
        query = session.query(
            Lander.id,
            Lander.vsl_id,
            Lander.redtrack_name,
            Lander.product,
            Lander.domain,
            Lander.vturb_player_id,
            func.sum(LanderDailyStats.revenue).label("revenue"),
            func.sum(LanderDailyStats.cost).label("cost"),
            func.sum(LanderDailyStats.profit).label("profit"),
            func.sum(LanderDailyStats.clicks).label("clicks"),
            func.sum(LanderDailyStats.purchases).label("purchases"),
            func.sum(LanderDailyStats.lp_views).label("lp_views"),
        ).join(
            LanderDailyStats, Lander.id == LanderDailyStats.lander_id
        ).filter(
            LanderDailyStats.date.between(date_from, date_to),
            Lander.is_active == 1,
        )

        if only_with_vsl:
            query = query.filter(Lander.vsl_id.isnot(None))

        if vsl_filter:
            query = query.filter(Lander.vsl_id == vsl_filter)

        query = query.group_by(Lander.id)
        lander_rows = query.all()

        # === OFFERS (ClickBank) ===
        offer_query = session.query(
            Offer.id,
            Offer.vsl_id,
            Offer.redtrack_name,
            Offer.product,
            func.sum(OfferDailyStats.revenue).label("revenue"),
            func.sum(OfferDailyStats.cost).label("cost"),
            func.sum(OfferDailyStats.profit).label("profit"),
            func.sum(OfferDailyStats.clicks).label("clicks"),
            func.sum(OfferDailyStats.purchases).label("purchases"),
            func.sum(OfferDailyStats.lp_views).label("lp_views"),
        ).join(
            OfferDailyStats, Offer.id == OfferDailyStats.offer_id
        ).filter(
            OfferDailyStats.date.between(date_from, date_to),
            Offer.is_active == 1,
        )

        if only_with_vsl:
            offer_query = offer_query.filter(Offer.vsl_id.isnot(None))

        if vsl_filter:
            offer_query = offer_query.filter(Offer.vsl_id == vsl_filter)

        offer_query = offer_query.group_by(Offer.id)
        offer_rows = offer_query.all()

        # VTurb query per lander (offers don't have VTurb)
        vturb_query = session.query(
            VturbDailyStats.lander_id,
            func.sum(VturbDailyStats.total_plays).label("plays"),
            func.sum(VturbDailyStats.unique_plays).label("viewed"),
            func.avg(VturbDailyStats.watch_rate).label("watch_rate"),
        ).filter(
            VturbDailyStats.date.between(date_from, date_to),
        ).group_by(VturbDailyStats.lander_id).all()

        vturb_map = {}
        for vt in vturb_query:
            vturb_map[vt.lander_id] = {
                "plays": int(vt.plays or 0),
                "viewed": int(vt.viewed or 0),
                "watch_rate": round(float(vt.watch_rate or 0), 2),
            }

        data = []

        # Process landers
        for row in lander_rows:
            revenue = float(row.revenue or 0)
            cost = float(row.cost or 0)
            profit = float(row.profit or 0)
            clicks = int(row.clicks or 0)
            purchases = int(row.purchases or 0)
            lp_views = int(row.lp_views or 0)

            roi = (profit / cost * 100) if cost > 0 else 0
            epc = (revenue / clicks) if clicks > 0 else 0
            conv_rate = (purchases / lp_views * 100) if lp_views > 0 else 0

            vt = vturb_map.get(row.id, {})
            plays = vt.get("plays", 0)
            viewed = vt.get("viewed", 0)
            watch_rate = vt.get("watch_rate", 0)
            hook_rate = round((plays / viewed * 100), 2) if viewed > 0 else 0
            body_rate = round((watch_rate / hook_rate * 100), 2) if hook_rate > 0 and watch_rate > 0 else 0

            data.append({
                "lander_id": row.id,
                "vsl_id": row.vsl_id or "Sem VSL",
                "lander_name": row.redtrack_name,
                "product": row.product or "",
                "domain": row.domain or "",
                "player_id": row.vturb_player_id or "",
                "revenue": round(revenue, 2),
                "cost": round(cost, 2),
                "profit": round(profit, 2),
                "roi": round(roi, 1),
                "epc": round(epc, 2),
                "clicks": clicks,
                "purchases": purchases,
                "lp_views": lp_views,
                "conv_rate": round(conv_rate, 1),
                "plays": plays,
                "viewed": viewed,
                "watch_rate": watch_rate,
                "hook_rate": hook_rate,
                "body_rate": body_rate,
            })

        # Process offers (same format, no VTurb data)
        for row in offer_rows:
            revenue = float(row.revenue or 0)
            cost = float(row.cost or 0)
            profit = float(row.profit or 0)
            clicks = int(row.clicks or 0)
            purchases = int(row.purchases or 0)
            lp_views = int(row.lp_views or 0)

            roi = (profit / cost * 100) if cost > 0 else 0
            epc = (revenue / clicks) if clicks > 0 else 0
            conv_rate = (purchases / lp_views * 100) if lp_views > 0 else 0

            data.append({
                "lander_id": row.id,
                "vsl_id": row.vsl_id or "Sem VSL",
                "lander_name": row.redtrack_name,
                "product": row.product or "",
                "domain": "",
                "player_id": "",
                "revenue": round(revenue, 2),
                "cost": round(cost, 2),
                "profit": round(profit, 2),
                "roi": round(roi, 1),
                "epc": round(epc, 2),
                "clicks": clicks,
                "purchases": purchases,
                "lp_views": lp_views,
                "conv_rate": round(conv_rate, 1),
                "plays": 0,
                "viewed": 0,
                "watch_rate": 0,
                "hook_rate": 0,
                "body_rate": 0,
            })

        df = pd.DataFrame(data)
        if df.empty:
            return df

        ascending = sort_dir == "asc"
        if sort_by in df.columns:
            df = df.sort_values(sort_by, ascending=ascending)

        return df.reset_index(drop=True)
    finally:
        session.close()

def get_lander_ranking(
    period: str = "30D",
    vsl_filter: Optional[str] = None,
    sort_by: str = "cost",
    sort_dir: str = "desc",
    only_with_vsl: bool = True,
) -> pd.DataFrame:
    """Get individual lander ranking (not grouped by VSL)."""
    session = get_session()
    try:
        date_from, date_to = get_date_range(period)

        query = session.query(
            Lander.id,
            Lander.redtrack_name,
            Lander.vsl_id,
            Lander.product,
            Lander.domain,
            func.sum(LanderDailyStats.revenue).label("revenue"),
            func.sum(LanderDailyStats.cost).label("cost"),
            func.sum(LanderDailyStats.profit).label("profit"),
            func.sum(LanderDailyStats.clicks).label("clicks"),
            func.sum(LanderDailyStats.purchases).label("purchases"),
            func.sum(LanderDailyStats.lp_views).label("lp_views"),
        ).join(
            LanderDailyStats, Lander.id == LanderDailyStats.lander_id
        ).filter(
            LanderDailyStats.date.between(date_from, date_to),
            Lander.is_active == 1,
        )

        if vsl_filter:
            query = query.filter(Lander.vsl_id == vsl_filter)

        if only_with_vsl:
            query = query.filter(Lander.vsl_id.isnot(None))

        query = query.group_by(Lander.id)
        rows = query.all()

        data = []
        for row in rows:
            revenue = float(row.revenue or 0)
            cost = float(row.cost or 0)
            profit = float(row.profit or 0)
            clicks = int(row.clicks or 0)
            purchases = int(row.purchases or 0)
            lp_views = int(row.lp_views or 0)

            roi = (profit / cost * 100) if cost > 0 else 0
            epc = (revenue / clicks) if clicks > 0 else 0
            conv_rate = (purchases / lp_views * 100) if lp_views > 0 else 0

            data.append({
                "lander_id": row.id,
                "lander_name": row.redtrack_name,
                "vsl_id": row.vsl_id or "Sem VSL",
                "product": row.product or "",
                "domain": row.domain or "",
                "revenue": round(revenue, 2),
                "cost": round(cost, 2),
                "profit": round(profit, 2),
                "roi": round(roi, 1),
                "epc": round(epc, 2),
                "clicks": clicks,
                "purchases": purchases,
                "lp_views": lp_views,
                "conv_rate": round(conv_rate, 1),
            })

        df = pd.DataFrame(data)
        if df.empty:
            return df

        ascending = sort_dir == "asc"
        if sort_by in df.columns:
            df = df.sort_values(sort_by, ascending=ascending)

        return df.reset_index(drop=True)
    finally:
        session.close()



def get_daily_performance(period: str = "30D", vsl_filter: Optional[str] = None) -> pd.DataFrame:
    """Get daily aggregated performance data for charts. Includes landers + offers."""
    session = get_session()
    try:
        date_from, date_to = get_date_range(period)

        # Lander daily data
        lander_query = session.query(
            LanderDailyStats.date,
            func.sum(LanderDailyStats.revenue).label("revenue"),
            func.sum(LanderDailyStats.cost).label("cost"),
            func.sum(LanderDailyStats.profit).label("profit"),
            func.sum(LanderDailyStats.clicks).label("clicks"),
            func.sum(LanderDailyStats.purchases).label("purchases"),
        ).join(
            Lander, Lander.id == LanderDailyStats.lander_id
        ).filter(
            LanderDailyStats.date.between(date_from, date_to),
            Lander.is_active == 1,
        )

        if vsl_filter:
            lander_query = lander_query.filter(Lander.vsl_id == vsl_filter)

        lander_query = lander_query.group_by(LanderDailyStats.date)
        lander_rows = lander_query.all()

        # Offer daily data
        offer_query = session.query(
            OfferDailyStats.date,
            func.sum(OfferDailyStats.revenue).label("revenue"),
            func.sum(OfferDailyStats.cost).label("cost"),
            func.sum(OfferDailyStats.profit).label("profit"),
            func.sum(OfferDailyStats.clicks).label("clicks"),
            func.sum(OfferDailyStats.purchases).label("purchases"),
        ).join(
            Offer, Offer.id == OfferDailyStats.offer_id
        ).filter(
            OfferDailyStats.date.between(date_from, date_to),
            Offer.is_active == 1,
        )

        if vsl_filter:
            offer_query = offer_query.filter(Offer.vsl_id == vsl_filter)

        offer_query = offer_query.group_by(OfferDailyStats.date)
        offer_rows = offer_query.all()

        # Merge by date
        daily_map = {}
        for row in lander_rows:
            d = row.date.strftime("%Y-%m-%d") if isinstance(row.date, date) else str(row.date)
            daily_map[d] = {
                "date": d,
                "revenue": float(row.revenue or 0),
                "cost": float(row.cost or 0),
                "profit": float(row.profit or 0),
                "clicks": int(row.clicks or 0),
                "purchases": int(row.purchases or 0),
            }

        for row in offer_rows:
            d = row.date.strftime("%Y-%m-%d") if isinstance(row.date, date) else str(row.date)
            if d in daily_map:
                daily_map[d]["revenue"] += float(row.revenue or 0)
                daily_map[d]["cost"] += float(row.cost or 0)
                daily_map[d]["profit"] += float(row.profit or 0)
                daily_map[d]["clicks"] += int(row.clicks or 0)
                daily_map[d]["purchases"] += int(row.purchases or 0)
            else:
                daily_map[d] = {
                    "date": d,
                    "revenue": float(row.revenue or 0),
                    "cost": float(row.cost or 0),
                    "profit": float(row.profit or 0),
                    "clicks": int(row.clicks or 0),
                    "purchases": int(row.purchases or 0),
                }

        # Sort by date and round
        data = sorted(daily_map.values(), key=lambda x: x["date"])
        for d in data:
            d["revenue"] = round(d["revenue"], 2)
            d["cost"] = round(d["cost"], 2)
            d["profit"] = round(d["profit"], 2)

        return pd.DataFrame(data)
    finally:
        session.close()


def get_available_vsls() -> List[str]:
    """Get list of distinct VSL IDs that have data (from landers + offers)."""
    session = get_session()
    try:
        # VSLs from landers
        lander_vsls = session.query(Lander.vsl_id).filter(
            Lander.vsl_id.isnot(None),
            Lander.is_active == 1,
        ).distinct().all()

        # VSLs from offers
        offer_vsls = session.query(Offer.vsl_id).filter(
            Offer.vsl_id.isnot(None),
            Offer.is_active == 1,
        ).distinct().all()

        all_vsls = set()
        for r in lander_vsls:
            if r.vsl_id:
                all_vsls.add(r.vsl_id)
        for r in offer_vsls:
            if r.vsl_id:
                all_vsls.add(r.vsl_id)

        return sorted(list(all_vsls))
    finally:
        session.close()


def get_available_products() -> List[str]:
    """Get list of distinct products."""
    session = get_session()
    try:
        rows = session.query(Lander.product).filter(
            Lander.product.isnot(None),
            Lander.is_active == 1,
        ).distinct().all()
        return sorted([r.product for r in rows if r.product])
    finally:
        session.close()


def get_sync_history(limit: int = 20) -> List[Dict]:
    """Get recent sync history."""
    session = get_session()
    try:
        rows = session.query(SyncLog).order_by(
            SyncLog.started_at.desc()
        ).limit(limit).all()
        return [
            {
                "id": r.id,
                "source": r.source,
                "sync_type": r.sync_type,
                "status": r.status,
                "date_from": r.date_from,
                "date_to": r.date_to,
                "records": r.records_processed,
                "error": r.error_message,
                "started": r.started_at.strftime("%Y-%m-%d %H:%M") if r.started_at else "",
                "completed": r.completed_at.strftime("%Y-%m-%d %H:%M") if r.completed_at else "",
            }
            for r in rows
        ]
    finally:
        session.close()

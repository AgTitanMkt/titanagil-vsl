"""
VTurb Analytics API Service

Fetches video metrics from VTurb Analytics API.
Base URL: https://analytics.vturb.net
Auth: X-Api-Token + X-Api-Version headers
Method: POST (all endpoints )
"""
import httpx
from typing import List, Dict, Any, Optional


VTURB_BASE_URL = "https://analytics.vturb.net"


def _headers(api_token: str ) -> Dict[str, str]:
    """Build auth headers for VTurb API."""
    return {
        "X-Api-Token": api_token,
        "X-Api-Version": "v1",
        "Content-Type": "application/json",
    }


def _fmt_date(date_str: str, end_of_day: bool = False) -> str:
    """Convert YYYY-MM-DD to YYYY-MM-DD HH:MM:SS format required by VTurb."""
    if " " in date_str:
        return date_str
    if end_of_day:
        return f"{date_str} 23:59:59"
    return f"{date_str} 00:00:00"


async def fetch_player_stats(
    api_token: str,
    date_from: str,
    date_to: str,
) -> Dict[str, Any]:
    """
    Fetch company-wide player stats from VTurb.
    Returns totals per player (started, finished, viewed).
    """
    body = {
        "events": ["started", "finished", "viewed"],
        "start_date": _fmt_date(date_from),
        "end_date": _fmt_date(date_to, end_of_day=True),
    }

    async with httpx.AsyncClient(timeout=60.0 ) as client:
        response = await client.post(
            f"{VTURB_BASE_URL}/events/total_by_company_players",
            headers=_headers(api_token),
            json=body,
        )
        response.raise_for_status()
        return response.json()


async def fetch_player_totals(
    api_token: str,
    player_id: str,
    date_from: str,
    date_to: str,
) -> Dict[str, int]:
    """
    Fetch total started/finished/viewed for a specific player.
    Returns dict like: {"started": 162488, "finished": 2140, "viewed": 181480}
    """
    body = {
        "player_id": player_id,
        "events": ["started", "finished", "viewed"],
        "start_date": _fmt_date(date_from),
        "end_date": _fmt_date(date_to, end_of_day=True),
    }

    async with httpx.AsyncClient(timeout=60.0 ) as client:
        response = await client.post(
            f"{VTURB_BASE_URL}/events/total_by_company",
            headers=_headers(api_token),
            json=body,
        )
        response.raise_for_status()
        data = response.json()

    result = {"started": 0, "finished": 0, "viewed": 0}
    if isinstance(data, list):
        for item in data:
            event = item.get("event", "")
            if event in result:
                result[event] = int(item.get("total", 0))
    return result


async def fetch_player_stats_by_day(
    api_token: str,
    player_id: str,
    date_from: str,
    date_to: str,
) -> List[Dict[str, Any]]:
    """
    Fetch daily event stats for a specific player.
    Returns list of dicts: [{"day": "2026-03-10", "started": 100, "finished": 5, "viewed": 120}, ...]
    """
    body = {
        "player_id": player_id,
        "events": ["started", "finished", "viewed"],
        "start_date": _fmt_date(date_from),
        "end_date": _fmt_date(date_to, end_of_day=True),
        "timezone": "America/Sao_Paulo",
    }

    async with httpx.AsyncClient(timeout=60.0 ) as client:
        response = await client.post(
            f"{VTURB_BASE_URL}/events/total_by_company_day",
            headers=_headers(api_token),
            json=body,
        )
        response.raise_for_status()
        data = response.json()

    # Parse: response is array of {event, events_by_day[{day, total, ...}]}
    # We need to merge into: [{day, started, finished, viewed}, ...]
    days_map = {}
    if isinstance(data, list):
        for event_group in data:
            event_name = event_group.get("event", "")
            for day_data in event_group.get("events_by_day", []):
                day = day_data.get("day", "")
                if day not in days_map:
                    days_map[day] = {"day": day, "started": 0, "finished": 0, "viewed": 0}
                days_map[day][event_name] = int(day_data.get("total", 0))

    return sorted(days_map.values(), key=lambda x: x["day"])


async def fetch_player_retention(
    api_token: str,
    player_id: str,
    date_from: str,
    date_to: str,
) -> Dict[str, Any]:
    """
    Fetch retention/timed data for a specific player.
    Note: This endpoint may return empty if conversions are not configured in VTurb.
    """
    body = {
        "player_id": player_id,
        "start_date": _fmt_date(date_from),
        "end_date": _fmt_date(date_to, end_of_day=True),
        "timezone": "America/Sao_Paulo",
    }

    async with httpx.AsyncClient(timeout=60.0 ) as client:
        response = await client.post(
            f"{VTURB_BASE_URL}/conversions/video_timed",
            headers=_headers(api_token),
            json=body,
        )
        response.raise_for_status()
        data = response.json()
        return {"grouped_timed": data if isinstance(data, list) else []}


async def test_connection(api_token: str) -> Dict[str, Any]:
    """Test VTurb API connection with a minimal request."""
    body = {
        "events": ["started"],
        "start_date": "2025-01-01 00:00:00",
    }

    async with httpx.AsyncClient(timeout=30.0 ) as client:
        response = await client.post(
            f"{VTURB_BASE_URL}/events/total_by_company",
            headers=_headers(api_token),
            json=body,
        )
        response.raise_for_status()
        return {"status": "connected", "code": response.status_code}

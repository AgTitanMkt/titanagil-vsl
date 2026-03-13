"""
RedTrack API Service

Fetches lander report data from RedTrack.
Optimized: single request for the full date range.
"""
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime


REDTRACK_BASE_URL = "https://api.redtrack.io/report"


async def fetch_lander_report(
    api_key: str,
    date_from: str,
    date_to: str,
 ) -> List[Dict[str, Any]]:
    """
    Fetch lander report from RedTrack in a SINGLE request.
    Groups by: landing (lander name).
    Returns all rows with financial metrics.
    """
    params = {
        "api_key": api_key,
        "group": "landing",
        "date_from": date_from,
        "date_to": date_to,
    }

    async with httpx.AsyncClient(timeout=60.0 ) as client:
        response = await client.get(REDTRACK_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("data", data.get("rows", []))
    return []


async def fetch_lander_report_by_day(
    api_key: str,
    date_from: str,
    date_to: str,
) -> List[Dict[str, Any]]:
    """
    Fetch lander report grouped by day + landing.
    For temporal charts.
    """
    params = {
        "api_key": api_key,
        "group": "day_landing",
        "date_from": date_from,
        "date_to": date_to,
    }

    async with httpx.AsyncClient(timeout=60.0 ) as client:
        response = await client.get(REDTRACK_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("data", data.get("rows", []))
    return []


async def test_connection(api_key: str) -> Dict[str, Any]:
    """Test RedTrack API connection with a minimal request."""
    params = {
        "api_key": api_key,
        "group": "landing",
        "date_from": datetime.now().strftime("%Y-%m-%d"),
        "date_to": datetime.now().strftime("%Y-%m-%d"),
    }

    async with httpx.AsyncClient(timeout=60.0 ) as client:
        response = await client.get(REDTRACK_BASE_URL, params=params)
        response.raise_for_status()
        return {"status": "connected", "code": response.status_code}


async def fetch_offer_report(
    api_key: str,
    date_from: str,
    date_to: str,
) -> List[Dict[str, Any]]:
    """
    Fetch offer report from RedTrack in a SINGLE request.
    Groups by: offer.
    Returns all rows with financial metrics.
    """
    params = {
        "api_key": api_key,
        "group": "offer",
        "date_from": date_from,
        "date_to": date_to,
    }

    async with httpx.AsyncClient(timeout=60.0 ) as client:
        response = await client.get(REDTRACK_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("data", data.get("rows", []))
    return []

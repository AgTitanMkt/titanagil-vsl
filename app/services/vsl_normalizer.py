"""
VSL Name Normalizer

Extracts VSL identifiers and product names from lander names (RedTrack)
and video names (VTurb).

Lander patterns: "MG | LP | LipoRise | VSL 70 | lifenutraforge.com"
Video patterns:  "[FB] LipoRise | VSL 70 | V1 | Lead 1 | Pitch: 36:57"

Rules:
- VSL 56.2 IS DIFFERENT from VSL 56 (distinct VSLs)
- Case-insensitive matching
- Normalize small variations (spacing, punctuation)
"""
import re
from typing import Optional


def extract_vsl_id(name: str) -> Optional[str]:
    """
    Extract VSL identifier from a lander or video name.
    Returns e.g. "VSL 70", "VSL 56.2", or None if no pattern found.
    """
    if not name:
        return None
    match = re.search(r'\bVSL[\s_-]*(\d+(?:\.\d+)?)\b', name, re.IGNORECASE)
    if not match:
        return None
    return f"VSL {match.group(1)}"


def extract_product_from_lander(lander_name: str) -> Optional[str]:
    """
    Extract product name from a RedTrack lander name.
    Pattern: "SOURCE | TYPE | PRODUCT | VSL XX | DOMAIN"
    """
    if not lander_name:
        return None
    segments = [s.strip() for s in lander_name.split("|")]
    vsl_index = None
    for i, s in enumerate(segments):
        if re.search(r'\bVSL\s*\d+', s, re.IGNORECASE):
            vsl_index = i
            break
    if vsl_index is None or vsl_index <= 0:
        return None

    skip_patterns = re.compile(
        r'^(LP|FBR|WL|Cartpanda|HC|DTC|EUA|V\d|Lead\s*\d|Pitch|Conta|BM|NI|Presell|TB|MG|FB|YT)',
        re.IGNORECASE
    )
    for i in range(vsl_index - 1, -1, -1):
        segment = segments[i].strip()
        # Remove brackets like [FB]
        segment = re.sub(r'^\[.*?\]\s*', '', segment).strip()
        if not skip_patterns.match(segment) and len(segment) > 2:
            return segment
    return None


def extract_product_from_video(video_name: str) -> Optional[str]:
    """
    Extract product name from a VTurb video name.
    Pattern: "[FB] Product | VSL XX | V1 | Lead 1 | Pitch: XX:XX"
    """
    if not video_name:
        return None
    segments = [s.strip() for s in video_name.split("|")]
    vsl_index = None
    for i, s in enumerate(segments):
        if re.search(r'\bVSL\s*\d+', s, re.IGNORECASE):
            vsl_index = i
            break
    if vsl_index is None or vsl_index <= 0:
        return None

    product = segments[vsl_index - 1].strip()
    # Remove brackets
    product = re.sub(r'^\[.*?\]\s*', '', product)
    # Remove "Cópia de"
    product = re.sub(r'^(Cópia\s+de\s+)+', '', product, flags=re.IGNORECASE)
    product = product.strip()
    return product if len(product) > 1 else None


def extract_domain_from_lander(lander_name: str) -> Optional[str]:
    """Extract domain from lander name (usually last segment)."""
    if not lander_name:
        return None
    segments = [s.strip() for s in lander_name.split("|")]
    # Look for domain-like pattern in segments
    for segment in reversed(segments):
        segment = segment.strip().split()[0]  # Take first word
        if re.match(r'^[a-z0-9][-a-z0-9]*\.[a-z]{2,}', segment, re.IGNORECASE):
            return segment
    return None


def is_lander_active(row: dict) -> bool:
    """
    Check if a lander is active (receiving data).
    Active = has revenue > 0 OR cost > 0 OR clicks > 0.
    """
    revenue = float(row.get("revenue", 0) or 0)
    cost = float(row.get("cost", 0) or 0)
    clicks = int(row.get("clicks", 0) or 0)
    return revenue > 0 or cost > 0 or clicks > 0

"""Maps founder/LLM industry wording onto Apollo's industry vocabulary.

Only industries need mapping: Apollo takes job titles and locations as free text.
The canonical list below is a SEED of LinkedIn-style industry names (which Apollo's industry
tags follow). It must be verified against the real Apollo plan in Sprint 3 (README open item 2);
anything that cannot be matched is reported back to the founder as 'unmapped' rather than
being silently dropped or guessed.
"""
import difflib
import re

CANONICAL_INDUSTRIES = [
    "information technology and services", "computer software", "internet",
    "computer and network security", "computer hardware", "semiconductors",
    "telecommunications", "financial services", "banking", "insurance",
    "investment management", "accounting", "marketing and advertising", "human resources",
    "staffing and recruiting", "management consulting", "legal services", "research",
    "hospital and health care", "pharmaceuticals", "biotechnology", "medical devices",
    "education management", "e-learning", "higher education", "retail", "consumer goods",
    "consumer services", "apparel and fashion", "food and beverages", "restaurants",
    "hospitality", "real estate", "construction", "architecture and planning", "design",
    "logistics and supply chain", "transportation/trucking/railroad", "automotive",
    "airlines/aviation", "oil and energy", "renewables and environment",
    "environmental services", "mechanical or industrial engineering", "wholesale",
    "media production", "online media", "entertainment", "events services",
    "nonprofit organization management", "government administration",
    "defense and space", "farming",
]

ALIASES = {
    "saas": "computer software", "software": "computer software",
    "b2b software": "computer software", "it": "information technology and services",
    "it services": "information technology and services", "it consulting":
    "information technology and services", "technology": "information technology and services",
    "fintech": "financial services", "finance": "financial services",
    "hr": "human resources", "hr tech": "human resources", "hrtech": "human resources",
    "recruitment": "staffing and recruiting", "recruiting": "staffing and recruiting",
    "staffing": "staffing and recruiting", "edtech": "e-learning",
    "education": "education management", "healthcare": "hospital and health care",
    "health care": "hospital and health care", "healthtech": "hospital and health care",
    "ecommerce": "internet", "e-commerce": "internet", "marketing": "marketing and advertising",
    "advertising": "marketing and advertising", "consulting": "management consulting",
    "cybersecurity": "computer and network security", "security": "computer and network security",
    "logistics": "logistics and supply chain", "supply chain": "logistics and supply chain",
    "telecom": "telecommunications", "energy": "oil and energy",
    "cleantech": "renewables and environment", "agritech": "farming", "agriculture": "farming",
    "media": "online media", "d2c": "consumer goods", "fmcg": "consumer goods",
    "legal": "legal services", "pharma": "pharmaceuticals",
}


def _norm(text: str) -> str:
    text = text.lower().replace("&", " and ")
    return " ".join(re.sub(r"[^a-z0-9/\- ]", " ", text).split())


_LOOKUP: dict[str, str] = {_norm(c): c for c in CANONICAL_INDUSTRIES}
_LOOKUP.update({_norm(a): c for a, c in ALIASES.items()})


FILLER_WORDS = {"b2b", "b2c", "b2b2c", "company", "companies", "industry", "sector", "startup",
                "startups", "firms", "firm", "enterprise", "smb", "smbs"}


def map_industry(name: str) -> str | None:
    key = _norm(name)
    stripped = " ".join(w for w in key.split() if w not in FILLER_WORDS)
    for candidate in dict.fromkeys(k for k in (key, stripped) if k):
        if candidate in _LOOKUP:
            return _LOOKUP[candidate]
    for candidate in dict.fromkeys(k for k in (key, stripped) if k):
        close = difflib.get_close_matches(candidate, _LOOKUP, n=1, cutoff=0.86)
        if close:
            return _LOOKUP[close[0]]
    return None


def map_industries(names: list[str]) -> tuple[list[str], list[str]]:
    """Returns (apollo_industries, unmapped_input_names), both de-duplicated, order preserved."""
    mapped: list[str] = []
    unmapped: list[str] = []
    for name in names:
        hit = map_industry(name)
        if hit is None:
            unmapped.append(name)
        elif hit not in mapped:
            mapped.append(hit)
    return mapped, unmapped

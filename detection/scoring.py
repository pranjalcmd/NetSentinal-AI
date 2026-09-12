SEVERITY_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}

def severity_for(score: int) -> str:
    if score >= 85: return "CRITICAL"
    if score >= 65: return "HIGH"
    if score >= 35: return "MEDIUM"
    return "LOW"

def clamp_score(value: int) -> int:
    return max(0, min(100, int(value)))

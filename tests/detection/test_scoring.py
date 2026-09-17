from detection.scoring import clamp_score, severity_for


# 11. scores are clamped to 100 (and to 0)
def test_clamp_score_upper_bound():
    assert clamp_score(150) == 100


def test_clamp_score_lower_bound():
    assert clamp_score(-10) == 0


def test_clamp_score_within_range_unchanged():
    assert clamp_score(50) == 50


# 12. severity boundaries are correct
def test_severity_boundaries():
    assert severity_for(0) == "LOW"
    assert severity_for(34) == "LOW"
    assert severity_for(35) == "MEDIUM"
    assert severity_for(64) == "MEDIUM"
    assert severity_for(65) == "HIGH"
    assert severity_for(84) == "HIGH"
    assert severity_for(85) == "CRITICAL"
    assert severity_for(100) == "CRITICAL"

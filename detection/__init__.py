"""Detection engine — rules, ML fusion, confidence and correlation.

Stdlib-only on purpose: this package is imported by the backend, never the
reverse, so it must not depend on FastAPI/pydantic.
"""
from detection.context import FlowContext
from detection.correlation import correlate
from detection.engine import DetectionResult, run_detection
from detection.rules.basic import build_alert, evaluate_flow
from detection.schemas import (
    CATEGORIES,
    FEATURE_SCHEMA_VERSION,
    Finding,
    Incident,
    Signal,
)
from detection.scoring import confidence, fuse, severity_for, severity_for_finding

__all__ = [
    "CATEGORIES",
    "FEATURE_SCHEMA_VERSION",
    "DetectionResult",
    "Finding",
    "FlowContext",
    "Incident",
    "Signal",
    "build_alert",
    "confidence",
    "correlate",
    "evaluate_flow",
    "fuse",
    "run_detection",
    "severity_for",
    "severity_for_finding",
]

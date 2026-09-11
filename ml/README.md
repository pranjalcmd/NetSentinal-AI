# nDPI-aware ML detection engine

The engine accepts the normalized flow schema emitted by `dpi/ndpi_adapter.py`.
Train `notebooks/01_ndpi_aware_detection_engine.ipynb` on a labelled network-flow
dataset to create `models/ndpi_detector.joblib`.

The model does not replace nDPI. It consumes nDPI protocol/risk signals alongside
flow behaviour and fuses deterministic nDPI evidence with ML output.

## Run
```python
from ml.detection_engine import DetectionEngine
engine = DetectionEngine("models/ndpi_detector.joblib")
result = engine.predict(flow)
```

If the artifact is absent, inference remains functional using transparent heuristic
fallbacks so the demo does not crash.

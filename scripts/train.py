"""Train the nDPI-aware flow classifier.

    python scripts/train.py

Reads data/dataset.json (see generate_dataset.py), fits a RandomForest on the
exact feature vector ml/detection_engine.py extracts at inference time, and
writes models/ndpi_detector.joblib in the shape DetectionEngine expects:

    {"model": ..., "feature_names": [...], "label_encoder": None, "test_flow_ids": [...]}

Labels stay strings (no LabelEncoder) so `model.classes_` — and therefore the
`probabilities` dict the API returns — is human-readable.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.detection_engine import extract_features  # noqa: E402


def load(dataset: Path) -> tuple[list[dict], list[str]]:
    flows = json.loads(dataset.read_text(encoding="utf-8"))
    missing = [f.get("flow_id") for f in flows if not f.get("label")]
    if missing:
        raise SystemExit(f"{len(missing)} flows have no label; regenerate the dataset")
    return flows, [f["label"] for f in flows]


def matrix(flows: list[dict], feature_names: list[str]) -> list[list[float]]:
    return [[extract_features(f).get(n, 0.0) for n in feature_names] for f in flows]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=ROOT / "data" / "dataset.json")
    parser.add_argument("--out", type=Path, default=ROOT / "models" / "ndpi_detector.joblib")
    parser.add_argument("--test-size", type=float, default=0.2)
    # Tuned against single-row latency: 60 shallow trees beat 200 unbounded ones
    # on this data (macro F1 0.919 vs 0.912) and predict ~3x faster per flow.
    parser.add_argument("--trees", type=int, default=60)
    parser.add_argument("--max-depth", type=int, default=8)
    parser.add_argument("--min-samples-leaf", type=int, default=4)
    parser.add_argument("--seed", type=int, default=1337)
    args = parser.parse_args()

    if not args.dataset.exists():
        raise SystemExit(f"{args.dataset} missing — run scripts/generate_dataset.py first")

    flows, labels = load(args.dataset)
    feature_names = sorted(extract_features(flows[0]))

    train_flows, test_flows, y_train, y_test = train_test_split(
        flows, labels, test_size=args.test_size, random_state=args.seed, stratify=labels
    )

    model = RandomForestClassifier(
        n_estimators=args.trees,
        max_depth=args.max_depth,
        min_samples_leaf=args.min_samples_leaf,
        class_weight="balanced_subsample",
        random_state=args.seed,
        n_jobs=-1,
    )

    started = time.perf_counter()
    model.fit(matrix(train_flows, feature_names), y_train)
    fit_seconds = time.perf_counter() - started

    predictions = model.predict(matrix(test_flows, feature_names))
    accuracy = accuracy_score(y_test, predictions)
    macro_f1 = f1_score(y_test, predictions, average="macro")

    # The API predicts one flow at a time. A forest fitted with n_jobs=-1 keeps
    # that setting, and joblib's parallel dispatch then costs ~35 ms *per row* —
    # 27 flows/s measured. Serial single-row predict is ~100x faster here.
    model.n_jobs = 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "feature_names": feature_names,
            "label_encoder": None,
            # Recorded so benchmark.py can score on held-out flows only.
            "test_flow_ids": [f["flow_id"] for f in test_flows],
            "trained_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "dataset": str(args.dataset),
        },
        args.out,
    )

    print(f"train {len(train_flows)} / test {len(test_flows)} flows, "
          f"{len(feature_names)} features, {args.trees} trees")
    print(f"fit {fit_seconds:.2f}s  test accuracy {accuracy:.4f}  macro F1 {macro_f1:.4f}")
    print(f"wrote {args.out} ({args.out.stat().st_size / 1e6:.2f} MB)")
    print("Run scripts/benchmark.py for the full report.")


if __name__ == "__main__":
    main()

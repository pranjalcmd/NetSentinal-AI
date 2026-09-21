"""Benchmark the detection stack on the held-out split.

    python scripts/benchmark.py

Reports five detectors on the same flows:

  rules            detection/rules/basic.py alone (binary: alert or no alert)
  ml-heuristic     DetectionEngine with no trained artifact
  ml-trained       DetectionEngine with models/ndpi_detector.joblib
  fused            the naive union of the two (rules OR ml) — the baseline the
                   engine has to beat
  engine (API)     detection.engine.run_detection: the same two sources fused
                   with caps, plus DPI, baseline and correlation, cut at the
                   alert threshold the API actually uses. This is what
                   /api/analyze/pcap returns.

The engine is also swept across every severity threshold, which is where the
table in backend/app/services/analysis.py comes from — re-run this after any
rule or weight change and update that comment with the new numbers.

Multi-class metrics only apply to the ML engines. The rule engine is binary by
construction, so it is scored binary only — comparing it on 8 classes would be
a rigged comparison.

Throughput is measured on this machine, single process, warm cache.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import joblib
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from detection.engine import run_detection  # noqa: E402
from detection.rules.basic import build_alert, evaluate_flow  # noqa: E402
from detection.scoring import SEVERITY_ORDER  # noqa: E402
from dpi.ndpi_adapter import NDPIAdapter  # noqa: E402
from dpi.pcap_flows import read_packets  # noqa: E402
from ml.detection_engine import DetectionEngine  # noqa: E402

DATASET_LABELS = [
    "BENIGN", "BOTNET", "BRUTE_FORCE", "DATA_EXFILTRATION",
    "DNS_TUNNELING", "DOS", "PORT_SCAN", "SUSPICIOUS_LEGACY_SERVICE",
]

# Ascending, so the sweep reads from "alert on everything" down to "alert on
# almost nothing".
SEVERITY_SWEEP = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]


def _binary(y_true: list[str], detected: list[bool]) -> dict:
    truth = [label != "BENIGN" for label in y_true]
    precision, recall, f1, _ = precision_recall_fscore_support(
        truth, detected, average="binary", zero_division=0
    )
    tp = sum(1 for t, d in zip(truth, detected) if t and d)
    fp = sum(1 for t, d in zip(truth, detected) if not t and d)
    fn = sum(1 for t, d in zip(truth, detected) if t and not d)
    tn = sum(1 for t, d in zip(truth, detected) if not t and not d)
    return {
        "accuracy": round(accuracy_score(truth, detected), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "false_positive_rate": round(fp / max(fp + tn, 1), 4),
    }


def _timed(fn, flows: list[dict]):
    started = time.perf_counter()
    out = [fn(f) for f in flows]
    elapsed = time.perf_counter() - started
    return out, elapsed, len(flows) / elapsed


def _worst_severity_per_flow(result) -> dict[str, str]:
    """A flow can carry several findings; the alert queue shows the worst one."""
    worst: dict[str, str] = {}
    for finding in result.findings:
        for flow_id in finding.related_flows:
            if SEVERITY_ORDER[finding.severity] > SEVERITY_ORDER.get(worst.get(flow_id, ""), -2):
                worst[flow_id] = finding.severity
    return worst


def _engine_sweep(evaluated: list[dict], y_true: list[str], ml: DetectionEngine) -> dict:
    """Run the real pipeline once, then score every alert threshold on it.

    One run, five thresholds: the severity cut is applied to the findings
    afterwards, so sweeping it costs nothing extra and the rows are guaranteed
    to come from the same detection pass.
    """
    started = time.perf_counter()
    result = run_detection(evaluated, ml, capture_id="benchmark")
    seconds = time.perf_counter() - started
    worst = _worst_severity_per_flow(result)

    rows = {}
    for threshold in SEVERITY_SWEEP:
        detected = [SEVERITY_ORDER.get(worst.get(f["flow_id"], ""), -2)
                    >= SEVERITY_ORDER[threshold] for f in evaluated]
        rows[threshold] = _binary(y_true, detected)
    return {
        "rows": rows,
        "seconds": round(seconds, 3),
        "flows_per_second": round(len(evaluated) / seconds),
        "findings": len(result.findings),
        "incidents": len(result.incidents),
        "ml_available": result.ml_available,
        "baseline_available": result.baseline_available,
    }


def _matrix_table(y_true: list[str], y_pred: list[str], labels: list[str]) -> str:
    matrix = confusion_matrix(y_true, y_pred, labels=labels)
    width = max(len(l) for l in labels) + 1
    header = " " * width + "".join(f"{l[:7]:>8}" for l in labels)
    rows = [header]
    for label, row in zip(labels, matrix):
        rows.append(f"{label:<{width}}" + "".join(f"{int(v):>8}" for v in row))
    rows.append("rows = truth, columns = prediction")
    return "\n".join(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=ROOT / "data" / "dataset.json")
    parser.add_argument("--artifact", type=Path, default=ROOT / "models" / "ndpi_detector.joblib")
    parser.add_argument("--pcap", type=Path, default=ROOT / "data" / "synthetic.pcap")
    parser.add_argument("--report", type=Path, default=ROOT / "data" / "benchmark.json")
    parser.add_argument("--all", action="store_true", help="score the full dataset, not just the test split")
    args = parser.parse_args()

    if not args.dataset.exists():
        raise SystemExit(f"{args.dataset} missing — run scripts/generate_dataset.py")

    flows = json.loads(args.dataset.read_text(encoding="utf-8"))
    by_id = {f["flow_id"]: f for f in flows}

    trained = DetectionEngine(artifact_path=args.artifact)
    heuristic = DetectionEngine(artifact_path=ROOT / "models" / "__no_such_artifact__")

    if args.all or not args.artifact.exists():
        evaluated, split = flows, "full dataset"
    else:
        test_ids = joblib.load(args.artifact).get("test_flow_ids") or []
        evaluated = [by_id[i] for i in test_ids if i in by_id] or flows
        split = f"held-out test split ({len(evaluated)} of {len(flows)})"

    y_true = [f["label"] for f in evaluated]
    hard = sum(1 for f in evaluated if f.get("boundary_case"))

    print("=" * 78)
    print("NetSentinel AI — detection benchmark")
    print("=" * 78)
    print(f"dataset      {args.dataset}")
    print(f"evaluated    {split}")
    print(f"boundary     {hard} ambiguous flows ({hard / len(evaluated):.1%}) — benign/attack "
          f"drawn from the same distribution, so <100% is expected")
    print(f"artifact     {args.artifact if trained.trained else 'NOT LOADED (heuristic only)'}")
    print()

    # ---------------- rules ----------------
    rule_alerts, rules_seconds, rules_rate = _timed(
        lambda f: build_alert(f, evaluate_flow(f)), evaluated
    )
    rules_binary = _binary(y_true, [a is not None for a in rule_alerts])

    # ---------------- ML engines ----------------
    heur_out, heur_seconds, heur_rate = _timed(heuristic.predict, evaluated)
    trained_out, trained_seconds, trained_rate = _timed(trained.predict, evaluated)

    heur_pred = [r["threat_category"] for r in heur_out]
    trained_pred = [r["threat_category"] for r in trained_out]

    heur_binary = _binary(y_true, [p != "BENIGN" for p in heur_pred])
    trained_binary = _binary(y_true, [p != "BENIGN" for p in trained_pred])
    fused_binary = _binary(
        y_true,
        [a is not None or p != "BENIGN" for a, p in zip(rule_alerts, trained_pred)],
    )

    # ---------------- the engine, as the API runs it ----------------
    from backend.app.services.analysis import ALERT_MIN_SEVERITY  # noqa: PLC0415

    engine = _engine_sweep(evaluated, y_true, trained)
    engine_binary = engine["rows"][ALERT_MIN_SEVERITY]

    # ---------------- binary table ----------------
    print("BINARY DETECTION  (is this flow malicious?)")
    print(f"{'detector':<16}{'acc':>8}{'prec':>8}{'recall':>8}{'F1':>8}{'FPR':>8}"
          f"{'TP':>7}{'FP':>7}{'FN':>7}{'flows/s':>12}")
    for name, metrics, rate in (
        ("rules", rules_binary, rules_rate),
        ("ml-heuristic", heur_binary, heur_rate),
        ("ml-trained", trained_binary, trained_rate),
        ("fused (naive)", fused_binary, 1 / (1 / rules_rate + 1 / trained_rate)),
        ("engine (API)", engine_binary, engine["flows_per_second"]),
    ):
        print(f"{name:<16}{metrics['accuracy']:>8.4f}{metrics['precision']:>8.4f}"
              f"{metrics['recall']:>8.4f}{metrics['f1']:>8.4f}"
              f"{metrics['false_positive_rate']:>8.4f}"
              f"{metrics['tp']:>7}{metrics['fp']:>7}{metrics['fn']:>7}{rate:>12,.0f}")
    print()

    # ---------------- alert-threshold sweep ----------------
    print(f"ALERT THRESHOLD SWEEP  (engine, cut at each severity; "
          f"ALERT_MIN_SEVERITY = {ALERT_MIN_SEVERITY})")
    print(f"{'threshold':<16}{'prec':>8}{'recall':>8}{'F1':>8}{'FPR':>8}{'alerts':>9}")
    for threshold in SEVERITY_SWEEP:
        row = engine["rows"][threshold]
        mark = "   <- default" if threshold == ALERT_MIN_SEVERITY else ""
        print(f"{threshold:<16}{row['precision']:>8.3f}{row['recall']:>8.3f}"
              f"{row['f1']:>8.3f}{row['false_positive_rate']:>8.3f}"
              f"{row['tp'] + row['fp']:>9}{mark}")
    print(f"  {engine['findings']:,} findings over {len(evaluated):,} flows, grouped into "
          f"{engine['incidents']:,} incidents in {engine['seconds']}s "
          f"(ML {'on' if engine['ml_available'] else 'OFF'}, "
          f"baseline {'on' if engine['baseline_available'] else 'OFF'})")
    print("  Copy this table into backend/app/services/analysis.py when it changes.")
    print()

    # ---------------- multi-class ----------------
    # Macro F1 is averaged over the dataset's classes only. The heuristic can
    # also emit SUSPICIOUS_TRAFFIC, which is not a label in the data — those
    # are counted as errors and reported separately rather than as a class with
    # zero support, which would skew the macro average.
    print("MULTI-CLASS  (which threat is it?)")
    for name, pred in (("ml-heuristic", heur_pred), ("ml-trained", trained_pred)):
        accuracy = accuracy_score(y_true, pred)
        macro = f1_score(y_true, pred, average="macro", labels=DATASET_LABELS, zero_division=0)
        weighted = f1_score(y_true, pred, average="weighted", labels=DATASET_LABELS, zero_division=0)
        extra = sum(1 for p in pred if p not in DATASET_LABELS)
        note = f"   (+{extra} SUSPICIOUS_TRAFFIC, not a dataset class)" if extra else ""
        print(f"  {name:<14} accuracy {accuracy:.4f}   macro F1 {macro:.4f}   "
              f"weighted F1 {weighted:.4f}{note}")
    print()
    print("Per-class, ml-trained:")
    print(classification_report(y_true, trained_pred, labels=DATASET_LABELS, zero_division=0))
    print("Confusion matrix, ml-trained:")
    print(_matrix_table(y_true, trained_pred, DATASET_LABELS))
    print()
    print("Per-class, ml-heuristic (no trained artifact):")
    print(classification_report(y_true, heur_pred, labels=DATASET_LABELS, zero_division=0))

    # ---------------- DPI throughput ----------------
    dpi = {}
    if args.pcap.exists():
        adapter = NDPIAdapter()
        started = time.perf_counter()
        packets = sum(1 for _ in read_packets(str(args.pcap)))
        read_seconds = time.perf_counter() - started

        started = time.perf_counter()
        pcap_flows = adapter.analyze_pcap(str(args.pcap))
        dpi_seconds = time.perf_counter() - started

        size_mb = args.pcap.stat().st_size / 1e6
        dpi = {
            "mode": adapter.mode,
            "ndpi_reader": adapter.reader_path,
            "pcap_mb": round(size_mb, 2),
            "packets": packets,
            "flows": len(pcap_flows),
            "seconds": round(dpi_seconds, 3),
            "packets_per_second": round(packets / dpi_seconds),
            "mbytes_per_second": round(size_mb / dpi_seconds, 2),
            "read_only_packets_per_second": round(packets / read_seconds),
        }
        print("DPI / CAPTURE PARSING")
        print(f"  mode              {dpi['mode']}"
              + (f" ({dpi['ndpi_reader']})" if dpi["ndpi_reader"] else " — ndpiReader not built here"))
        print(f"  capture           {dpi['pcap_mb']} MB, {packets:,} packets -> {len(pcap_flows):,} flows")
        print(f"  throughput        {dpi['packets_per_second']:,} packets/s   "
              f"{dpi['mbytes_per_second']} MB/s   ({dpi['seconds']}s wall)")

        # End-to-end: parse + detect, the /api/analyze/pcap path.
        started = time.perf_counter()
        for flow in pcap_flows:
            build_alert(flow, evaluate_flow(flow))
            trained.predict(flow)
        end_to_end = dpi_seconds + (time.perf_counter() - started)
        dpi["end_to_end_seconds"] = round(end_to_end, 3)
        dpi["end_to_end_flows_per_second"] = round(len(pcap_flows) / end_to_end)
        print(f"  parse + detect    {dpi['end_to_end_flows_per_second']:,} flows/s "
              f"({dpi['end_to_end_seconds']}s for the whole capture)")
        print()

    report = {
        "dataset": str(args.dataset),
        "evaluated": split,
        "flows_evaluated": len(evaluated),
        "boundary_cases": hard,
        "trained_model_loaded": trained.trained,
        "binary": {
            "rules": rules_binary,
            "ml_heuristic": heur_binary,
            "ml_trained": trained_binary,
            "fused": fused_binary,
            "engine": engine_binary,
        },
        "engine": {
            "alert_min_severity": ALERT_MIN_SEVERITY,
            "threshold_sweep": engine["rows"],
            "findings": engine["findings"],
            "incidents": engine["incidents"],
            "seconds": engine["seconds"],
            "ml_available": engine["ml_available"],
            "baseline_available": engine["baseline_available"],
        },
        "multiclass": {
            "ml_heuristic": {
                "accuracy": round(accuracy_score(y_true, heur_pred), 4),
                "macro_f1": round(f1_score(y_true, heur_pred, average="macro", labels=DATASET_LABELS, zero_division=0), 4),
            },
            "ml_trained": {
                "accuracy": round(accuracy_score(y_true, trained_pred), 4),
                "macro_f1": round(f1_score(y_true, trained_pred, average="macro", labels=DATASET_LABELS, zero_division=0), 4),
                "per_class": classification_report(
                    y_true, trained_pred, labels=DATASET_LABELS, zero_division=0, output_dict=True
                ),
            },
        },
        "throughput_flows_per_second": {
            "rules": round(rules_rate),
            "ml_heuristic": round(heur_rate),
            "ml_trained": round(trained_rate),
            "engine": engine["flows_per_second"],
        },
        "dpi": dpi,
    }
    args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"wrote {args.report}")


if __name__ == "__main__":
    main()

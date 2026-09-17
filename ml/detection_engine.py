"""
nDPI-aware ML detection engine for NetSentinel AI.

Consumes normalized nDPI flow records and produces:
- threat category
- calibrated confidence (when a trained model is available)
- ML score
- nDPI risk contribution
- fused risk score/severity
- human-readable evidence

The engine is deliberately defensive: it can operate in demo/fallback mode
when no trained artifact exists, while keeping the exact same output schema.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json, math, re

try:
    import joblib
except Exception:
    joblib = None

FEATURE_VERSION = "ndpi-flow-v1"

APPLICATIONS = [
    "UNKNOWN","DNS","HTTP","HTTPS","QUIC","SSH","FTP","SMTP","TELNET",
    "RDP","SMB","NTP","DHCP","ICMP","TOR","BITTORRENT"
]
TRANSPORTS = ["UNKNOWN","TCP","UDP","ICMP","SCTP"]

THREAT_LABELS = [
    "BENIGN","DNS_TUNNELING","PORT_SCAN","DOS","BOTNET",
    "BRUTE_FORCE","DATA_EXFILTRATION","SUSPICIOUS_LEGACY_SERVICE"
]

NDPI_RISK_WEIGHTS = {
    "RISKY_DOMAIN": 28, "MALICIOUS_HOST": 35, "SUSPICIOUS_DNS": 28,
    "UNUSUAL_PORT": 18, "KNOWN_PROTOCOL": 0, "RISKY": 25,
}

def _num(x, default=0.0):
    try:
        v=float(x)
        return v if math.isfinite(v) else default
    except Exception:
        return default

def _bool(x):
    return bool(x) if isinstance(x, bool) else str(x).lower() in {"1","true","yes","y"}

def _norm_risk(r):
    s=re.sub(r"[^A-Z0-9]+","_",str(r).upper()).strip("_")
    aliases={
        "RISKY_DOMAIN":"RISKY_DOMAIN","RISKY_DOMAIN_NAME":"RISKY_DOMAIN",
        "MALICIOUS_HOST":"MALICIOUS_HOST","SUSPICIOUS_DNS":"SUSPICIOUS_DNS",
        "UNUSUAL_PORT":"UNUSUAL_PORT"
    }
    return aliases.get(s,s)

def extract_features(flow: dict[str, Any]) -> dict[str, float]:
    m=flow.get("metadata") or {}
    packets=_num(flow.get("packets")); bytes_=_num(flow.get("bytes"))
    duration=max(_num(flow.get("duration_seconds"),1),0.001)
    src_port=_num(flow.get("source_port"),-1)
    dst_port=_num(flow.get("destination_port"),-1)
    app=str(flow.get("application") or "UNKNOWN").upper()
    transport=str(flow.get("transport") or "UNKNOWN").upper()
    risks=[_norm_risk(x) for x in (flow.get("ndpi_risks") or [])]
    pps=packets/duration
    bps=bytes_/duration
    avg_pkt=bytes_/max(packets,1)
    qlen=_num(m.get("avg_query_length"))
    dns_entropy=_num(m.get("dns_query_entropy"))
    out_ratio=_num(m.get("outbound_ratio"), 1.0 if _bool(m.get("high_outbound_ratio")) else 0.0)
    repeated=1.0 if _bool(m.get("repeated_destination")) else 0.0
    unique_dst=_num(m.get("unique_destinations"))
    failed=_num(m.get("failed_connections"))
    syn=_num(m.get("syn_packets"))
    rst=_num(m.get("rst_packets"))
    return {
        "packets":packets,"bytes":bytes_,"duration_seconds":duration,
        "packets_per_second":pps,"bytes_per_second":bps,"avg_packet_size":avg_pkt,
        "source_port":src_port,"destination_port":dst_port,
        "avg_query_length":qlen,"dns_query_entropy":dns_entropy,
        "outbound_ratio":out_ratio,"repeated_destination":repeated,
        "unique_destinations":unique_dst,"failed_connections":failed,
        "syn_packets":syn,"rst_packets":rst,
        "ndpi_risk_count":float(len(risks)),
        "ndpi_risk_weight":float(sum(NDPI_RISK_WEIGHTS.get(r,25) for r in risks)),
        "app_is_dns":float(app=="DNS"),"app_is_https":float(app=="HTTPS"),
        "app_is_ssh":float(app=="SSH"),"app_is_http":float(app=="HTTP"),
        "app_is_unknown":float(app=="UNKNOWN"),
        "transport_is_tcp":float(transport=="TCP"),
        "transport_is_udp":float(transport=="UDP"),
        "port_is_dns":float(dst_port==53),"port_is_http":float(dst_port==80),
        "port_is_https":float(dst_port==443),
        "port_is_ssh":float(dst_port==22),
        "port_is_telnet":float(dst_port in {23,2323}),
    }

def feature_vector(flow: dict[str,Any], feature_names: list[str]|None=None):
    f=extract_features(flow)
    names=feature_names or sorted(f)
    return [f.get(n,0.0) for n in names]

def _severity(score):
    if score>=85:return "CRITICAL"
    if score>=65:return "HIGH"
    if score>=35:return "MEDIUM"
    return "LOW"

def _heuristic(flow):
    f=extract_features(flow); app=str(flow.get("application") or "").upper()
    score=0; evidence=[]; label="BENIGN"
    if app=="DNS" and f["packets_per_second"]>=4:
        score+=30; evidence.append(f"DNS flow frequency is {f['packets_per_second']:.1f} packets/sec.")
        label="DNS_TUNNELING"
    if app=="DNS" and f["avg_query_length"]>=55:
        score+=25; evidence.append(f"Average DNS query length is {f['avg_query_length']:.0f} characters.")
        label="DNS_TUNNELING"
    if f["destination_port"] in {23,2323}:
        score+=25; evidence.append(f"Legacy remote-access port {int(f['destination_port'])} was observed.")
        label="SUSPICIOUS_LEGACY_SERVICE"
    if f["unique_destinations"]>=20 or (f["syn_packets"]>=30 and f["failed_connections"]>=10):
        score+=35; evidence.append("Connection fan-out/failure pattern is consistent with scanning.")
        label="PORT_SCAN"
    if f["bytes_per_second"]>=5_000_000 and f["outbound_ratio"]>=0.7:
        score+=30; evidence.append("High outbound byte rate combined with outbound-heavy traffic.")
        label="DATA_EXFILTRATION"
    if f["repeated_destination"]:
        score+=15; evidence.append("Repeated communication with the same destination.")
    for r in flow.get("ndpi_risks") or []:
        rr=_norm_risk(r); w=NDPI_RISK_WEIGHTS.get(rr,25)
        score+=w; evidence.append(f"nDPI risk indicator: {r}.")
    score=min(100,score)
    if label=="BENIGN" and score>=35: label="SUSPICIOUS_TRAFFIC"
    return label, score, evidence

@dataclass
class DetectionEngine:
    artifact_path: str|Path = "models/ndpi_detector.joblib"
    model: Any = None
    feature_names: list[str]|None = None
    label_encoder: Any = None

    def __post_init__(self):
        self.artifact_path=Path(self.artifact_path)
        if self.model is None and joblib and self.artifact_path.exists():
            try:
                artifact=joblib.load(self.artifact_path)
                self.model=artifact.get("model")
                self.feature_names=artifact.get("feature_names")
                self.label_encoder=artifact.get("label_encoder")
            except Exception:
                self.model=None

    @property
    def trained(self): return self.model is not None

    def predict(self, flow: dict[str,Any]) -> dict[str,Any]:
        heuristic_label, heuristic_score, evidence=_heuristic(flow)
        ml_label=heuristic_label; confidence=min(0.99,max(.51,heuristic_score/100))
        probabilities={}
        if self.model is not None:
            try:
                x=[feature_vector(flow,self.feature_names)]
                pred=self.model.predict(x)[0]
                if self.label_encoder is not None:
                    ml_label=str(self.label_encoder.inverse_transform([pred])[0])
                else: ml_label=str(pred)
                if hasattr(self.model,"predict_proba"):
                    probs=self.model.predict_proba(x)[0]
                    classes=getattr(self.model,"classes_",[])
                    probabilities={str(c):float(p) for c,p in zip(classes,probs)}
                    confidence=max(probabilities.values()) if probabilities else confidence
            except Exception as e:
                evidence.append("ML artifact inference failed; heuristic evidence used.")
        # Fuse ML confidence with deterministic nDPI signal.
        ml_risk=0 if ml_label=="BENIGN" else round(100*confidence)
        ndpi_score=min(100, int(extract_features(flow)["ndpi_risk_weight"]))
        final_score=min(100, round(0.55*max(heuristic_score,ml_risk)+0.45*ndpi_score))
        if ml_label=="BENIGN" and heuristic_label!="BENIGN": final_label=heuristic_label
        elif ml_label!="BENIGN": final_label=ml_label
        else: final_label="BENIGN"
        if final_label=="BENIGN" and final_score>=35: final_label="SUSPICIOUS_TRAFFIC"
        return {
            "engine":"ndpi-aware-ml",
            "feature_version":FEATURE_VERSION,
            "trained_model":self.trained,
            "threat_category":final_label,
            "ml_category":ml_label,
            "confidence":round(float(confidence),4),
            "risk_score":int(final_score),
            "severity":_severity(final_score),
            "ml_score":int(ml_risk),
            "ndpi_score":int(ndpi_score),
            "evidence":list(dict.fromkeys(evidence)),
            "probabilities":probabilities,
            "flow_id":flow.get("flow_id"),
        }

    def batch_predict(self, flows):
        return [self.predict(f) for f in flows]

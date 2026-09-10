from backend.app.core.config import settings

class AIService:
    async def explain(self, alert: dict, flow: dict) -> dict:
        # Replace this mock with your chosen provider in the hackathon.
        # Keep the output schema stable regardless of provider.
        return {
            "threat_category": alert["title"],
            "severity": alert["severity"],
            "confidence": min(0.95, 0.55 + alert["risk_score"] / 200),
            "summary": (
                "The observed flow contains multiple indicators that warrant investigation. "
                "This assessment is based on the supplied telemetry and should not be treated as proof of compromise."
            ),
            "observed_evidence": alert["evidence"],
            "recommendations": [
                "Inspect the originating endpoint.",
                "Review the destination/domain history in your approved telemetry.",
                "Correlate the alert with endpoint and authentication logs.",
            ],
            "caveats": [
                "Anomaly indicators can have benign explanations.",
                "AI is an analyst-assistance layer, not the sole detection authority.",
            ],
        }

ai_service = AIService()

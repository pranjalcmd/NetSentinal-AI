import os
from google import genai
from google.genai import types

class NetSentinelAICopilot:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key) if api_key else genai.Client()
        
        self.system_instruction = (
            "You are NetSentinel AI, an expert network security copilot and assistant. "
            "Analyze network logs, security alerts, traffic patterns, and provide clear, "
            "actionable cybersecurity remediation steps. Keep responses technical, precise, and well-structured."
        )

    def analyze_query(self, prompt: str, context: str = "") -> str:
        full_prompt = f"Context/Logs:\n{context}\n\nUser Query:\n{prompt}" if context else prompt
        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=self.system_instruction,
                    temperature=0.3,
                ),
            )
            return response.text
        except Exception as e:
            return f"AI Copilot Error: {str(e)}"

copilot_service = NetSentinelAICopilot()

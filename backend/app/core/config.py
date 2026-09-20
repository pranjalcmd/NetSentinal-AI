from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# netsentinel/ root — so paths in .env may stay relative to the project
ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # --- AI analyst layer -------------------------------------------------
    # "mock" = offline canned answers. Set ai_api_key to use Claude.
    # Override ai_provider to switch to openai / gemini / ollama.
    ai_provider: str = "mock"
    ai_api_url: str | None = None
    ai_api_key: str | None = None
    ai_model: str = "claude-opus-5"

    # --- OpenAI provider --------------------------------------------------
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"

    # --- Google Gemini provider -------------------------------------------
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"

    # --- Ollama local provider --------------------------------------------
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"

    # --- Detection --------------------------------------------------------
    model_path: str = str(ROOT / "models" / "ndpi_detector.joblib")

    # --- Storage / upload -------------------------------------------------
    database_path: str = "./netsentinel.db"
    max_upload_mb: int = 100

    # --- Orchestration ----------------------------------------------------
    max_job_workers: int = 4
    prompt_token_budget: int = 6000

    # Either location works; backend/.env takes priority if both exist.
    model_config = SettingsConfigDict(
        env_file=(ROOT / ".env", ROOT / "backend" / ".env"),
        extra="ignore",
        protected_namespaces=(),
    )


settings = Settings()

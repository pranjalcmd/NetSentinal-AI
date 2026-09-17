from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# netsentinel/ — so paths in .env may stay relative to the project, not the cwd.
ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # --- AI analyst layer -------------------------------------------------
    # "mock" = canned answers, no network. Set ai_api_key to go live.
    ai_provider: str = "mock"
    ai_api_url: str | None = None
    ai_api_key: str | None = None
    ai_model: str = "claude-opus-5"

    # --- Detection --------------------------------------------------------
    model_path: str = str(ROOT / "models" / "ndpi_detector.joblib")

    database_path: str = "./netsentinel.db"
    # Captures kept in that file; the oldest are dropped past this (PRD §32).
    max_stored_jobs: int = 50
    max_upload_mb: int = 100

    # Either location works; backend/.env wins if both exist.
    model_config = SettingsConfigDict(
        env_file=(ROOT / ".env", ROOT / "backend" / ".env"),
        extra="ignore",
        protected_namespaces=(),  # allow the model_path field name
    )


settings = Settings()

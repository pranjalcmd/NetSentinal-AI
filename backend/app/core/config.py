from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    ai_provider: str = "mock"
    ai_api_url: str | None = None
    ai_api_key: str | None = None
    ai_model: str | None = None
    database_path: str = "./netsentinel.db"
    max_upload_mb: int = 100
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

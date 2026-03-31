from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    # Allow local development via a root `.env` file.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = Field(..., description="SQLAlchemy async database URL")
    REDIS_URL: str = Field(..., description="Redis URL for broker and pub/sub")

    UPLOAD_DIR: str = Field(default="./uploads")
    MAX_FILE_SIZE: int = Field(default=10 * 1024 * 1024, description="Max upload size in bytes")

    ALLOWED_ORIGINS: str = Field(default="http://localhost:3000", description="Comma-separated list of allowed origins")

    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None


settings = Settings()


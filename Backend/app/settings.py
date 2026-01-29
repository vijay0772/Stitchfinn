from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str  # Neon connection string (async)
    api_key_pepper: str = "change-me"
    vendor_timeout_s: float = 3.0
    max_retries: int = 3

    class Config:
        env_file = ".env"

settings = Settings()

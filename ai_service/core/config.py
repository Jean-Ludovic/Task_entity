from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    llm_timeout_seconds: int = 25
    llm_max_retries: int = 1
    # Clé optionnelle pour sécuriser les routes IA côté Vercel.
    # Si définie, chaque requête doit inclure le header X-AI-Secret-Key.
    ai_secret_key: str = ""


settings = Settings()  # type: ignore[call-arg]

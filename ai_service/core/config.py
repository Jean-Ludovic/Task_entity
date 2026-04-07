from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Branche local : LLM_PROVIDER=ollama → utilise Ollama local (gratuit, pas de clé)
    # Branche main  : LLM_PROVIDER=openai → utilise l'API OpenAI
    llm_provider: str = "ollama"

    # OpenAI (utilisé si llm_provider=openai)
    openai_api_key: str = "not-needed-for-ollama"
    openai_model: str = "gpt-4o-mini"

    # Ollama (utilisé si llm_provider=ollama)
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "llama3.2"

    llm_timeout_seconds: int = 60  # Ollama local est plus lent qu'une API cloud
    llm_max_retries: int = 1
    ai_secret_key: str = ""


settings = Settings()  # type: ignore[call-arg]

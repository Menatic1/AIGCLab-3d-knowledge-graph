from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM（默认接入火山引擎方舟 Ark，兼容 OpenAI 协议）
    LLM_BASE_URL: str = "https://ark.cn-beijing.volces.com/api/v3"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "doubao-1-5-pro-32k-250115"
    LLM_TIMEOUT: int = 90

    # Storage
    UPLOAD_DIR: str = "./data/uploads"
    SQLITE_URL: str = "sqlite:///./data/app.db"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,http://127.0.0.1:5176,http://127.0.0.1:5177"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()

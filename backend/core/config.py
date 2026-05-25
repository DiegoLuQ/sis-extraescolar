from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    EXTERNAL_DB_MC_URL: str
    EXTERNAL_DB_DP_URL: str
    FRONTEND_URL: str = "http://localhost:3000"
    
    # Credenciales SMTP opcionales
    MC_SENDER_EMAIL: str | None = None
    MC_SENDER_PASSWORD: str | None = None
    DP_SENDER_EMAIL: str | None = None
    DP_SENDER_PASSWORD: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

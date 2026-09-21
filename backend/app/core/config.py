"""
Application configuration — reads from environment / .env file.
All secrets via AWS Secrets Manager in production; .env in local dev.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── General ────────────────────────────────────────────────────────────
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_SECRETS_MANAGER"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── Data ───────────────────────────────────────────────────────────────
    DATA_DIR: str = "data"          # local Parquet folder
    S3_BUCKET: str = ""            # set in production
    S3_PREFIX: str = "parquet/"
    USE_S3: bool = False

    # ── LLM Provider ───────────────────────────────────────────────────────
    # mock = fully offline, deterministic responses (default for demos)
    # bedrock = AWS Bedrock (Claude)
    # anthropic = Anthropic direct API
    # sarvam = Sarvam AI (Indic LLM + Audio)
    LLM_PROVIDER: Literal["mock", "bedrock", "anthropic", "sarvam"] = "mock"
    BEDROCK_MODEL_ID: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"
    ANTHROPIC_API_KEY: str = ""
    SARVAM_API_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    BEDROCK_MAX_TOKENS: int = 4096
    BEDROCK_TEMPERATURE: float = 0.1

    # ── RAG ────────────────────────────────────────────────────────────────
    RAG_DOCS_DIR: str = "data/docs"
    VECTOR_STORE_PATH: str = "data/vector_store"
    EMBEDDING_PROVIDER: Literal["bedrock", "sentence_transformers"] = "sentence_transformers"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # ── AWS ────────────────────────────────────────────────────────────────
    DYNAMODB_TABLE_PREFIX: str = "InsureNexus"
    COGNITO_USER_POOL_ID: str = ""
    COGNITO_CLIENT_ID: str = ""

    # ── CORS ───────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "" # Comma-separated. If empty, defaults to * in local dev.

    # ── ML ─────────────────────────────────────────────────────────────────
    ML_MODELS_DIR: str = "ml/models"
    ANOMALY_CONTAMINATION: float = 0.05
    FRAUD_SCORE_THRESHOLD: float = 0.60

    # ── Caching ────────────────────────────────────────────────────────────
    CACHE_TTL_SECONDS: int = 300
    QUERY_TIMEOUT_SECONDS: int = 30
    MAX_QUERY_ROWS: int = 50_000

    # ── Feature flags ──────────────────────────────────────────────────────
    DEMO_MODE: bool = True          # enables guided walkthrough
    RATE_LIMIT_RPM: int = 60


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

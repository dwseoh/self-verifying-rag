from pathlib import Path
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    cerebras_api_key: str = ""
    cerebras_base_url: str = "https://api.cerebras.ai/v1"
    cerebras_model: str = "gemma-4-31b"
    trustloop_mock: bool = False
    # Return static fixtures from /api/verify (frontend-only dev)
    trustloop_fixture_api: bool = False

    trustloop_repo_path: Path = ROOT / "data" / "demo_repo"
    trustloop_corpus_path: Path = ROOT / "data" / "engineering_corpus"
    trustloop_store_path: Path = ROOT / "data" / "store"

    @field_validator("trustloop_mock", "trustloop_fixture_api", mode="before")
    @classmethod
    def parse_bool_fields(cls, value: Any) -> bool:
        return _coerce_bool(value)

    @property
    def use_mock(self) -> bool:
        return self.trustloop_mock or not self.cerebras_api_key

    def resolve_repo_path(self, repo_path: str | None) -> Path:
        if not repo_path:
            return self.trustloop_repo_path
        path = Path(repo_path)
        if not path.is_absolute():
            path = ROOT / path
        return path


settings = Settings()

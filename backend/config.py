import os
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
    trustloop_fixture_api: bool = False

    trustloop_repo_path: Path = ROOT / "data" / "demo_repo"
    trustloop_corpus_path: Path = ROOT / "data" / "engineering_corpus"
    trustloop_store_path: Path = ROOT / "data" / "store"
    trustloop_clones_path: Path = ROOT / "data" / "clones"
    trustloop_allow_absolute_paths: bool = True
    trustloop_public_api_url: str = ""
    trustloop_git_repo: str = ""
    trustloop_cors_origins: str = ""
    github_clone_token: str = ""
    trustloop_snapshot_max_files: int = 80

    @field_validator("trustloop_mock", "trustloop_fixture_api", "trustloop_allow_absolute_paths", mode="before")
    @classmethod
    def parse_bool_fields(cls, value: Any) -> bool:
        return _coerce_bool(value)

    @property
    def use_mock(self) -> bool:
        return self.trustloop_mock or not self.cerebras_api_key

    def cors_origins(self) -> list[str]:
        raw = self.trustloop_cors_origins.strip()
        if raw:
            return [part.strip() for part in raw.split(",") if part.strip()]
        return ["*"]

    def discovery_roots(self) -> list[Path]:
        home = Path.home()
        candidates: list[Path] = []
        extra = os.environ.get("TRUSTLOOP_DISCOVERY_ROOTS", "")
        for part in extra.split(":"):
            if part.strip():
                candidates.append(Path(part.strip()))
        candidates.extend(
            [
                home / "Projects",
                home / "dev",
                home / "code",
                home / "src",
                ROOT,
            ]
        )
        out: list[Path] = []
        seen: set[str] = set()
        for p in candidates:
            key = str(p)
            if key not in seen:
                seen.add(key)
                out.append(p)
        return out

    def resolve_repo_path(self, repo_path: str | None) -> Path:
        if not repo_path:
            return self.trustloop_repo_path
        path = Path(repo_path)
        if path.is_absolute():
            if not self.trustloop_allow_absolute_paths:
                raise ValueError("Absolute repo paths are disabled on this deployment")
            return path
        return ROOT / path


settings = Settings()

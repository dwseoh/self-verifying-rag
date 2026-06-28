from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    cerebras_api_key: str = ""
    cerebras_base_url: str = "https://api.cerebras.ai/v1"
    cerebras_model: str = "gemma-4-31b"
    trustloop_mock: bool = False

    trustloop_repo_path: Path = ROOT / "data" / "demo_repo"
    trustloop_corpus_path: Path = ROOT / "data" / "engineering_corpus"
    trustloop_store_path: Path = ROOT / "data" / "store"

    @property
    def use_mock(self) -> bool:
        return self.trustloop_mock or not self.cerebras_api_key


settings = Settings()

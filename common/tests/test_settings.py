import pytest

from common.settings import Settings


def test_reads_upper_case_env_vars_and_treats_empty_as_unset():
    s = Settings.from_env({"DATABASE_URL": "postgresql://x", "LLM_MODEL": ""})
    assert s.database_url == "postgresql://x"
    assert s.llm_model is None


def test_require_names_every_missing_variable():
    with pytest.raises(RuntimeError, match="DATABASE_URL, ENGINE_URL"):
        Settings.from_env({}).require("database_url", "engine_url")


def test_api_key_is_not_in_repr():
    assert "secret" not in repr(Settings.from_env({"LLM_API_KEY": "secret"}))

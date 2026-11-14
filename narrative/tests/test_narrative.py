import httpx

from app import prompt
from app.main import get_llm
from common.template import template_sentence

EN_TEMPLATE = "Helsinki is 5.7 pp below the 80% target for breast cancer screening attendance in 2024, ranking 21 of 23."
FI_TEMPLATE = (
    "Helsinki: rintasyöpäseulontaan osallistuminen 74,3 % vuonna 2024, "
    "5,7 prosenttiyksikköä alle tavoitteen (80 %). Sijoitus 21/23."
)
GOOD_LLM = (
    "Helsinki's breast cancer screening attendance was 74.3% in 2024, 5.7 percentage points below the 80% "
    "national target, ranking 21 of 23 Regions. The strategy calls for raising participation through targeted invitations."
)


def post(client, req, **overrides):
    body = req.model_dump(mode="json") | overrides
    r = client.post("/narrative", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# --- acceptance: invented number -> Template sentence -------------------------


def test_invented_number_is_rejected_and_replaced_by_template_sentence(client, with_llm, helsinki_request):
    with_llm("Helsinki is 6.2 pp below the 80% target, ranking 21 of 23.")
    body = post(client, helsinki_request)
    assert body["source"] == "template"
    assert body["text"] == EN_TEMPLATE
    assert body["rejected_numbers"] == ["6.2"]
    assert body["numbers_checked"] is True


def test_verified_llm_output_is_returned(client, with_llm, helsinki_request):
    fake = with_llm(GOOD_LLM)
    body = post(client, helsinki_request)
    assert (body["source"], body["text"], body["numbers_checked"]) == ("llm", GOOD_LLM, True)
    assert body["rejected_numbers"] == []
    assert len(fake.calls) == 1


def test_llm_output_using_decimal_comma_and_pp_passes(client, with_llm, helsinki_request):
    with_llm("Helsinki is 5,7 pp below the 80 % target in 2024, ranking 21 of 23.")
    assert post(client, helsinki_request)["source"] == "llm"


def test_llm_output_over_60_words_is_replaced(client, with_llm, helsinki_request):
    with_llm(" ".join(["Helsinki"] * 61))
    body = post(client, helsinki_request)
    assert (body["source"], body["text"]) == ("template", EN_TEMPLATE)


def test_llm_failure_falls_back_to_template_sentence(client, with_llm, helsinki_request):
    with_llm(httpx.ConnectError("no network"))
    body = post(client, helsinki_request)
    assert (body["source"], body["text"]) == ("template", EN_TEMPLATE)


# --- acceptance: no LLM configured -------------------------------------------


def test_no_llm_env_returns_template_sentence_and_health_is_200(client, no_llm_env, helsinki_request):
    assert get_llm() is None
    assert client.get("/health").status_code == 200
    body = post(client, helsinki_request)
    assert (body["source"], body["text"], body["numbers_checked"]) == ("template", EN_TEMPLATE, True)


# --- acceptance: Finnish --------------------------------------------------------


def test_finnish_template_sentence_for_helsinki_uses_decimal_commas(client, with_llm, helsinki_request):
    fake = with_llm(GOOD_LLM)
    body = post(client, helsinki_request, language="fi")
    assert body["text"] == FI_TEMPLATE
    assert "74,3" in body["text"] and "5,7" in body["text"]
    assert "74.3" not in body["text"] and "5.7" not in body["text"]
    assert (body["source"], body["language"], body["numbers_checked"]) == ("template", "fi", True)
    assert fake.calls == []  # LLM Narratives are English only


def test_finnish_without_finnish_indicator_name_is_422(client, helsinki_request):
    body = helsinki_request.model_dump(mode="json") | {"language": "fi", "indicator_name_fi": None}
    assert client.post("/narrative", json=body).status_code == 422


# --- acceptance: prompt_version on every response -----------------------------


def test_prompt_version_is_in_every_response(client, with_llm, no_llm_env, helsinki_request):
    responses = [post(client, helsinki_request), post(client, helsinki_request, language="fi")]
    with_llm(GOOD_LLM)
    responses.append(post(client, helsinki_request))
    with_llm("Invented 99.9.")
    responses.append(post(client, helsinki_request))
    assert {r["source"] for r in responses} == {"llm", "template"}
    assert all(r["prompt_version"] == prompt.PROMPT_VERSION for r in responses)


# --- the prompt itself -------------------------------------------------------


def test_prompt_is_strict_and_temperature_zero(monkeypatch, helsinki_request):
    sent = {}

    def fake_post(url, headers, json, timeout):
        sent.update(url=url, headers=headers, json=json)
        return httpx.Response(200, json={"choices": [{"message": {"content": GOOD_LLM}}]}, request=httpx.Request("POST", url))

    monkeypatch.setenv("LLM_BASE_URL", "http://llm.local/v1/")
    monkeypatch.setenv("LLM_MODEL", "some-model")
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.setattr(httpx, "post", fake_post)

    assert get_llm().complete(prompt.messages(helsinki_request)) == GOOD_LLM
    assert sent["url"] == "http://llm.local/v1/chat/completions"
    assert sent["headers"] == {"Authorization": "Bearer k"}
    assert sent["json"]["temperature"] == 0
    assert sent["json"]["model"] == "some-model"
    system = sent["json"]["messages"][0]["content"]
    assert "Use only the figures" in system and "2 or 3 sentences" in system and "at most 60 words" in system


def test_template_sentences_pass_their_own_number_check(helsinki_request):
    from app.numbers import allowed_numbers, unverified_numbers

    for lang in ("en", "fi"):
        req = helsinki_request.model_copy(update={"language": lang})
        assert unverified_numbers(template_sentence(req), allowed_numbers(prompt.facts(req))) == []


def test_percent_units_with_a_description_use_pp(helsinki_request):
    # The seeded unit for 3621 is "% of invited", not "%".
    req = helsinki_request.model_copy(update={"unit": "% of invited", "region_name": "City of Helsinki"})
    assert template_sentence(req) == (
        "City of Helsinki is 5.7 pp below the 80% target for breast cancer screening attendance in 2024, ranking 21 of 23."
    )
    fi = req.model_copy(update={"language": "fi"})
    assert "5,7 prosenttiyksikköä alle tavoitteen (80 %)" in template_sentence(fi)
    assert prompt.facts(req)["gap_unit"] == "percentage points"


def test_peer_median_and_at_reference_wording(helsinki_request):
    gap = helsinki_request.gap.model_copy(update={"reference_kind": "peer_median", "reference_value": 84.3, "deviation": -10.0})
    req = helsinki_request.model_copy(update={"gap": gap})
    assert template_sentence(req) == (
        "Helsinki is 10 pp below the median of 23 Regions (84.3%) for breast cancer screening attendance in 2024, ranking 21 of 23."
    )
    at = helsinki_request.gap.model_copy(update={"value": 80.0, "deviation": 0.0, "direction": "at"})
    assert template_sentence(helsinki_request.model_copy(update={"gap": at})).startswith("Helsinki is at the 80% target")


# --- /config (engine keys its Narrative cache on it) -----------------------------


def test_config_without_llm_has_empty_model(client, no_llm_env):
    body = client.get("/config").json()
    assert body == {"prompt_version": prompt.PROMPT_VERSION, "model": ""}


def test_config_with_llm_reports_the_model(client, monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.local/v1")
    monkeypatch.setenv("LLM_MODEL", "some-model")
    assert client.get("/config").json() == {"prompt_version": prompt.PROMPT_VERSION, "model": "some-model"}

import json

import httpx
import pytest

from app.core.errors import LLMConfigError, LLMError, TransientError
from app.llm.providers import AnthropicProvider, OllamaProvider, OpenAIProvider

ARGS = dict(system="SYS", messages=[{"role": "user", "content": "hi"}], model="m1",
            max_tokens=200, temperature=0.0)


def transport(status=200, body=None, capture=None, raises=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if capture is not None:
            capture["url"] = str(request.url)
            capture["headers"] = dict(request.headers)
            capture["json"] = json.loads(request.content)
        if raises:
            raise raises
        return httpx.Response(status, json=body if body is not None else {})
    return httpx.MockTransport(handler)


def openai(t, **kw):
    return OpenAIProvider(api_key="sk-test", base_url="https://api.openai.test/v1",
                          timeout=5, transport=t, **kw)


def anthropic(t):
    return AnthropicProvider(api_key="ak-test", base_url="https://api.anthropic.test",
                             timeout=5, transport=t)


def ollama(t):
    return OllamaProvider(base_url="http://ollama.test:11434", timeout=5, transport=t)


OPENAI_OK = {"choices": [{"message": {"content": '{"a":1}'}}],
             "usage": {"prompt_tokens": 11, "completion_tokens": 7}}
ANTHROPIC_OK = {"content": [{"type": "text", "text": '{"a":'}, {"type": "text", "text": "1}"}],
                "usage": {"input_tokens": 12, "output_tokens": 8}}
OLLAMA_OK = {"message": {"content": '{"a":1}'}, "prompt_eval_count": 13, "eval_count": 9}


def test_openai_request_and_response():
    seen = {}
    r = openai(transport(body=OPENAI_OK, capture=seen)).complete(**ARGS)
    assert (r.text, r.input_tokens, r.output_tokens) == ('{"a":1}', 11, 7)
    assert seen["url"] == "https://api.openai.test/v1/chat/completions"
    assert seen["headers"]["authorization"] == "Bearer sk-test"
    p = seen["json"]
    assert p["model"] == "m1" and p["response_format"] == {"type": "json_object"}
    assert p["messages"][0] == {"role": "system", "content": "SYS"} and p["temperature"] == 0.0
    assert p["max_completion_tokens"] == 200


def test_openai_can_omit_temperature():
    seen = {}
    openai(transport(body=OPENAI_OK, capture=seen), send_temperature=False).complete(**ARGS)
    assert "temperature" not in seen["json"]


def test_anthropic_request_and_response():
    seen = {}
    r = anthropic(transport(body=ANTHROPIC_OK, capture=seen)).complete(**ARGS)
    assert (r.text, r.input_tokens, r.output_tokens) == ('{"a":1}', 12, 8)
    assert seen["url"] == "https://api.anthropic.test/v1/messages"
    assert seen["headers"]["x-api-key"] == "ak-test"
    assert seen["headers"]["anthropic-version"] == "2023-06-01"
    p = seen["json"]
    assert p["system"] == "SYS" and p["messages"] == ARGS["messages"] and p["max_tokens"] == 200


def test_ollama_request_and_response():
    seen = {}
    r = ollama(transport(body=OLLAMA_OK, capture=seen)).complete(**ARGS)
    assert (r.text, r.input_tokens, r.output_tokens) == ('{"a":1}', 13, 9)
    assert seen["url"] == "http://ollama.test:11434/api/chat"
    p = seen["json"]
    assert p["stream"] is False and p["format"] == "json"
    assert p["options"] == {"temperature": 0.0, "num_predict": 200}
    assert p["messages"][0]["role"] == "system"
    assert "authorization" not in seen["headers"]


def test_provider_flags():
    assert OllamaProvider(base_url="http://x", timeout=1).is_free is True
    assert openai(transport()).is_free is False and anthropic(transport()).is_free is False


@pytest.mark.parametrize("make", [openai, anthropic, ollama])
@pytest.mark.parametrize("status,exc", [
    (429, TransientError), (500, TransientError), (503, TransientError),
    (401, LLMConfigError), (403, LLMConfigError), (404, LLMConfigError),
    (400, LLMError),
])
def test_http_errors_map_to_the_same_exceptions(make, status, exc):
    with pytest.raises(exc) as info:
        make(transport(status=status, body={"error": "x"})).complete(**ARGS)
    if status == 400:
        assert not isinstance(info.value, (TransientError, LLMConfigError))


@pytest.mark.parametrize("make", [openai, anthropic, ollama])
def test_network_failures_are_transient(make):
    for err in (httpx.ReadTimeout("slow"), httpx.ConnectError("down")):
        with pytest.raises(TransientError):
            make(transport(raises=err)).complete(**ARGS)


@pytest.mark.parametrize("make,body", [(openai, {"choices": []}), (anthropic, {"content": "x"}),
                                       (ollama, {"nope": 1})])
def test_unexpected_response_shapes_raise_llm_error(make, body):
    with pytest.raises(LLMError):
        make(transport(body=body)).complete(**ARGS)


def test_missing_keys_are_config_errors():
    with pytest.raises(LLMConfigError):
        OpenAIProvider(api_key="", base_url="https://x", timeout=1)
    with pytest.raises(LLMConfigError):
        AnthropicProvider(api_key="", base_url="https://x", timeout=1)

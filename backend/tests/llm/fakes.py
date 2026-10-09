from app.llm.providers import LLMResult


class FakeProvider:
    """Scripted provider: each item is an LLMResult to return or an Exception to raise."""

    def __init__(self, replies, *, is_free=False, name="fake"):
        self.replies, self.is_free, self.name = list(replies), is_free, name
        self.calls: list[dict] = []

    def complete(self, **kwargs):
        self.calls.append(kwargs)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def ok(text: str, tokens_in: int = 1000, tokens_out: int = 500) -> LLMResult:
    return LLMResult(text, tokens_in, tokens_out)

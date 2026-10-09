import logging
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("app.errors")


class ApiError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(
        self, message: str, *, code: str | None = None, details: dict[str, Any] | None = None
    ):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        self.details = details or {}


class Unauthorized(ApiError):
    status_code = 401
    code = "unauthorized"


class Forbidden(ApiError):
    status_code = 403
    code = "forbidden"


class NotFound(ApiError):
    status_code = 404
    code = "not_found"


class Conflict(ApiError):
    status_code = 409
    code = "conflict"


class TooManyRequests(ApiError):
    status_code = 429
    code = "too_many_requests"


class Unprocessable(ApiError):
    status_code = 422
    code = "unprocessable"


class ServiceUnavailable(ApiError):
    status_code = 503
    code = "service_unavailable"


class LLMError(Exception):
    """A non-retryable LLM failure (bad request, unusable output)."""


class LLMConfigError(LLMError):
    """The LLM provider is not configured correctly (missing key or model, rejected key)."""


class LLMOutputError(LLMError):
    """The model replied, but not with valid structured output, even after one repair attempt."""


class BudgetExceeded(Exception):
    """Raised when the per-startup spend cap would be exceeded (used from Sprint 2)."""


class TransientError(Exception):
    """A failure worth retrying (timeouts, 429, 5xx from a provider)."""


def _body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"code": code, "message": message, "details": details or {}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(_body(exc.code, exc.message, exc.details), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(
            _body("validation_error", "Invalid request", {"errors": errors}), status_code=422
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(_body("http_error", str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        request_id = uuid.uuid4().hex
        log.exception("Unhandled error request_id=%s", request_id)
        return JSONResponse(
            _body("internal_error", "Something went wrong", {"request_id": request_id}),
            status_code=500,
        )

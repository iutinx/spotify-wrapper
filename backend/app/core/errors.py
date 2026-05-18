"""Error handling utilities for RFC 7807 Problem Details."""
import uuid
from typing import Optional

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.schemas.errors import ErrorResponse, FieldError


def generate_request_id() -> str:
    """Generate a unique request ID for debugging."""
    return f"req_{uuid.uuid4().hex[:12]}"


def create_error_response(
    request: Request,
    status_code: int,
    title: str,
    detail: str,
    code: str,
    docs_url: Optional[str] = None,
    field_errors: Optional[list[FieldError]] = None,
) -> JSONResponse:
    """
    Create a standardized RFC 7807 error response.

    Args:
        request: The FastAPI request object
        status_code: HTTP status code
        title: Short human-readable summary
        detail: Detailed explanation
        code: Machine-readable error code
        docs_url: Optional link to documentation
        field_errors: Optional list of field-level validation errors
    """
    error = ErrorResponse(
        type=f"https://api.example.com/errors/{code.replace('_', '-')}",
        title=title,
        status=status_code,
        detail=detail,
        instance=str(request.url.path),
        code=code,
        docs_url=docs_url,
        request_id=generate_request_id(),
        field_errors=field_errors,
    )
    return JSONResponse(
        status_code=status_code,
        content=error.model_dump(mode="json", exclude_none=True),
    )


def create_validation_error(
    request: Request,
    detail: str,
    field_errors: list[FieldError],
) -> JSONResponse:
    """Create a validation error response."""
    return create_error_response(
        request=request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        title="Validation Failed",
        detail=detail,
        code="validation_error",
        docs_url="https://docs.example.com/api/errors#validation",
        field_errors=field_errors,
    )


def create_authentication_error(
    request: Request,
    detail: str = "Missing or invalid authentication token",
) -> JSONResponse:
    """Create an authentication error response."""
    return create_error_response(
        request=request,
        status_code=status.HTTP_401_UNAUTHORIZED,
        title="Authentication Required",
        detail=detail,
        code="authentication_required",
        docs_url="https://docs.example.com/api/auth",
    )


def create_forbidden_error(
    request: Request,
    detail: str = "You do not have permission to perform this action",
) -> JSONResponse:
    """Create a forbidden error response."""
    return create_error_response(
        request=request,
        status_code=status.HTTP_403_FORBIDDEN,
        title="Forbidden",
        detail=detail,
        code="forbidden",
        docs_url="https://docs.example.com/api/errors#forbidden",
    )


def create_not_found_error(
    request: Request,
    detail: str = "The requested resource was not found",
) -> JSONResponse:
    """Create a not found error response."""
    return create_error_response(
        request=request,
        status_code=status.HTTP_404_NOT_FOUND,
        title="Not Found",
        detail=detail,
        code="not_found",
        docs_url="https://docs.example.com/api/errors#not-found",
    )


def create_bad_request_error(
    request: Request,
    detail: str,
    code: str = "bad_request",
    docs_url: Optional[str] = None,
) -> JSONResponse:
    """Create a bad request error response."""
    return create_error_response(
        request=request,
        status_code=status.HTTP_400_BAD_REQUEST,
        title="Bad Request",
        detail=detail,
        code=code,
        docs_url=docs_url,
    )


def create_internal_error(
    request: Request,
    detail: str = "An unexpected error occurred",
) -> JSONResponse:
    """Create an internal server error response."""
    return create_error_response(
        request=request,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        title="Internal Server Error",
        detail=detail,
        code="internal_error",
        docs_url="https://docs.example.com/api/errors#internal",
    )


def create_rate_limit_error(
    request: Request,
    detail: str = "Rate limit exceeded. Please try again later.",
) -> JSONResponse:
    """Create a rate limit error response."""
    return create_error_response(
        request=request,
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        title="Rate Limit Exceeded",
        detail=detail,
        code="rate_limit_exceeded",
        docs_url="https://docs.example.com/api/errors#rate-limit",
    )

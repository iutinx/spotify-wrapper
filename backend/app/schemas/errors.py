"""RFC 7807 Problem Details error schema."""
from typing import Optional

from pydantic import BaseModel, Field


class FieldError(BaseModel):
    """Validation error for a specific field."""

    field: str
    message: str
    code: str


class ErrorResponse(BaseModel):
    """
    RFC 7807 Problem Details error response.

    Provides standardized, machine-readable error responses with:
    - Stable error codes for frontend handling
    - Documentation links for self-service resolution
    - Request IDs for support debugging
    - Field-level validation errors
    """

    type: str = Field(
        ...,
        description="URI reference for error type (e.g., https://api.example.com/errors/auth-required)",
    )
    title: str = Field(..., description="Short human-readable summary of the error")
    status: int = Field(..., description="HTTP status code")
    detail: str = Field(..., description="Detailed explanation of the error")
    instance: str = Field(..., description="Request path that caused the error")
    code: str = Field(..., description="Machine-readable error code (stable across API versions)")
    docs_url: Optional[str] = Field(None, description="Link to documentation for resolving this error")
    request_id: Optional[str] = Field(None, description="Request ID for support debugging")
    field_errors: Optional[list[FieldError]] = Field(None, description="Field-level validation errors")

    class Config:
        json_schema_extra = {
            "example": {
                "type": "https://api.example.com/errors/auth-required",
                "title": "Authentication Required",
                "status": 401,
                "detail": "Missing or invalid authentication token",
                "instance": "/api/users/me/currently-playing",
                "code": "authentication_required",
                "docs_url": "https://docs.example.com/api/auth",
                "request_id": "req_abc123",
            }
        }


# Error code registry - stable codes that won't change between API versions
ERROR_CODES = {
    400: "bad_request",
    401: "authentication_required",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "validation_error",
    429: "rate_limit_exceeded",
    500: "internal_error",
    503: "service_unavailable",
}

# Business logic error codes
BUSINESS_ERROR_CODES = {
    "self_friend_request": "self_friend_request_forbidden",
    "blocked_user": "user_is_blocked",
    "already_friends": "already_friends",
    "friend_request_pending": "friend_request_pending",
    "friend_request_not_found": "friend_request_not_found",
    "friendship_not_found": "friendship_not_found",
    "notification_not_found": "notification_not_found",
    "user_not_found": "user_not_found",
    "profile_not_found": "profile_not_found",
    "invalid_visibility": "invalid_visibility_setting",
    "cannot_cancel_own_request": "cannot_cancel_own_friend_request",
}

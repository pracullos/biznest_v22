from starlette.requests import Request
from starlette.responses import Response
from typing import Callable, Awaitable


async def auth_enforcement_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """No-op passthrough. Authentication is enforced at route level via get_authenticated_user."""
    return await call_next(request)

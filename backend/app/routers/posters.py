"""Poster export authorization.

The server decides watermarking, template access and usage limits, and signs a
short-lived export token. The client must request authorization before every
download; a modified browser flag cannot grant a paid feature because the
signed token (and the usage counter) come from here.

Limitation (documented in README): poster pixels are rendered in the browser,
so the watermark itself is drawn client-side from this server-issued decision.
Anything stronger (server-rendered PNGs) needs a headless-browser function.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from ..config import Settings, get_settings
from ..models import ExportAuthorizeRequest, ExportAuthorizeResponse
from ..security import get_current_user, verify_token
from ..services.entitlements import authorize_export
from ..store.base import Store

router = APIRouter(prefix="/api/posters", tags=["posters"])


def get_store(request: Request) -> Store:
    return request.app.state.store


@router.post("/authorize-export", response_model=ExportAuthorizeResponse)
async def authorize(
    payload: ExportAuthorizeRequest,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
    store: Store = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> ExportAuthorizeResponse:
    result = await authorize_export(
        store,
        settings,
        user,
        template_key=payload.template_key,
        width=payload.width,
        height=payload.height,
    )
    await store.append_audit(
        {
            "actor_id": user["id"],
            "action": "poster.export_authorized",
            "target": payload.template_key,
            "metadata": {
                "plan_id": result["plan_id"],
                "watermark": result["watermark"],
                "size": f"{payload.width}x{payload.height}",
            },
        }
    )
    return ExportAuthorizeResponse(**result)


@router.get("/verify-token")
async def verify_export_token(
    token: str,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Lets tests/tools confirm an export token was issued by this server."""
    payload = verify_token(token, settings.secret_key, expected_type="export")
    return {"valid": payload is not None, "payload": payload}

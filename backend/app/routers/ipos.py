"""Public IPO endpoints.

Read-only, cached. A visitor loading the dashboard never triggers an
external source request (the service caches and dedupes fetches).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse

from ..config import Settings, get_settings
from ..models import IpoListMeta, IpoListResponse, IpoRecord
from ..providers.ipopremium import guess_media_type
from ..services.ipo_service import IpoService

router = APIRouter(prefix="/api", tags=["ipos"])


def get_service(request: Request) -> IpoService:
    return request.app.state.ipo_service


@router.get("/ipos", response_model=IpoListResponse)
async def list_ipos(
    request: Request,
    q: str = Query(default="", max_length=80),
    category: str = Query(default="", pattern="^(|Mainboard|SME|mainboard|sme)$"),
    state: str = Query(default="", alias="status",
                       pattern="^(|upcoming|open|closed|listed)$"),
    service: IpoService = Depends(get_service),
    settings: Settings = Depends(get_settings),
) -> IpoListResponse:
    snap = await service.list_records(q=q, category=category, status=state)
    return IpoListResponse(
        items=snap.records,
        meta=IpoListMeta(
            last_updated=snap.last_updated,
            stale=snap.stale,
            provider=snap.provider,
            demo_mode=snap.demo_mode,
            source_error=snap.error,
            total=len(snap.records),
        ),
    )


@router.get("/ipos/{ipo_id}/logo")
async def get_ipo_logo(
    ipo_id: str,
    service: IpoService = Depends(get_service),
) -> FileResponse:
    """Company logo saved by the local scraper cache (404 when absent)."""
    path = service.ipopremium.logo_path(ipo_id)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo not found")
    return FileResponse(
        path,
        media_type=guess_media_type(path),
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/ipos/{ipo_id}", response_model=IpoRecord)
async def get_ipo(
    ipo_id: str,
    service: IpoService = Depends(get_service),
) -> IpoRecord:
    record = await service.get_record(ipo_id)
    if record is None or record.hidden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="IPO not found")
    return record

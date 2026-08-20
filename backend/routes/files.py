from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from schema.DocumentDto import DocumentUploadResponse, PresignedUrlResponse
from models.user import User
from services import file_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_file(
    file: UploadFile,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    return await file_service.upload_file(file, current_user, db)


@router.get("/{file_id}")
def download_file(file_id: str) -> StreamingResponse:
    return file_service.download_file(file_id)


@router.get("/{file_id}/presigned", response_model=PresignedUrlResponse)
def get_presigned_url(
    file_id: str,
    expires_hours: int = 1,
) -> PresignedUrlResponse:
    """
    Get a presigned URL for direct MinIO file access.

    The returned URL allows direct downloads from MinIO without requiring
    this API to stream the file. Useful for large files or frontend integrations.

    Query parameters:
    - expires_hours: URL validity duration in hours (default 1, max 24)
    """
    # Cap at 24 hours for security
    expires_hours = min(expires_hours, 24)
    return file_service.get_presigned_url(file_id, expires_hours=expires_hours)

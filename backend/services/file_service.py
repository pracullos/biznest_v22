import io
import uuid
from datetime import timedelta

from fastapi import HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from minio.error import S3Error
from sqlalchemy.orm import Session

from core.minio_client import minio_client, BUCKET_NAME
from schema.DocumentDto import DocumentUploadResponse, PresignedUrlResponse
from models.document import Document
from models.user import User


async def upload_file(file: UploadFile, owner: User, db: Session) -> DocumentUploadResponse:
    file_id = f"{uuid.uuid4()}_{file.filename}"
    content = await file.read()

    minio_client.put_object(
        BUCKET_NAME,
        file_id,
        data=io.BytesIO(content),
        length=len(content),
        content_type=file.content_type,
    )

    document = Document(
        file_id=file_id,
        file_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        owner_id=owner.id,
    )
    db.add(document)
    db.commit()

    db.refresh(document)
    return DocumentUploadResponse(file_id=str(document.id), url=f"/files/{file_id}")


def download_file(file_id: str) -> StreamingResponse:
    try:
        stat = minio_client.stat_object(BUCKET_NAME, file_id)
        obj = minio_client.get_object(BUCKET_NAME, file_id)
    except S3Error:
        raise HTTPException(status_code=404, detail="File not found")

    def iterfile():
        try:
            for chunk in iter(lambda: obj.read(1024 * 1024), b""):
                yield chunk
        finally:
            try:
                obj.close()
            finally:
                try:
                    obj.release_conn()
                except Exception:
                    pass

    filename = file_id.split("_", 1)[-1] if "_" in file_id else file_id
    media_type = getattr(stat, "content_type", None) or "application/octet-stream"
    return StreamingResponse(
        iterfile(),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def get_presigned_url(file_id: str, expires_hours: int = 1) -> PresignedUrlResponse:
    """
    Generate a presigned URL for a file in MinIO.

    The presigned URL allows direct access to the file without requiring
    server-side streaming. Useful for frontend downloads.

    Args:
        file_id: MinIO object key
        expires_hours: URL validity duration (default 1 hour)

    Returns:
        PresignedUrlResponse with the presigned URL and expiration time

    Raises:
        HTTPException: 404 if file not found in MinIO
    """
    try:
        # Verify file exists
        minio_client.stat_object(BUCKET_NAME, file_id)
    except S3Error:
        raise HTTPException(status_code=404, detail="File not found")

    expires_delta = timedelta(hours=expires_hours)
    expires_seconds = int(expires_delta.total_seconds())

    presigned_url = minio_client.get_presigned_url(
        method="GET",
        bucket_name=BUCKET_NAME,
        object_name=file_id,
        expires=expires_delta,
    )

    return PresignedUrlResponse(
        file_id=file_id,
        presigned_url=presigned_url,
        expires_in_seconds=expires_seconds,
    )

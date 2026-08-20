from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from typing import Annotated


class DocumentUploadResponse(BaseModel):
    file_id: str
    url: str


class PresignedUrlResponse(BaseModel):
    file_id: str
    presigned_url: Annotated[
        str,
        Field(description="MinIO presigned URL (valid for 1 hour)")
    ]
    expires_in_seconds: Annotated[
        int,
        Field(description="URL expiration time in seconds (default 3600)")
    ]


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    file_id: str
    file_name: str
    file_type: str
    file_size: int
    owner_id: UUID
    created_at: datetime
    updated_at: datetime
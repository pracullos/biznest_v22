from enums.job import JobStatus
from pydantic import BaseModel, Field
from typing import Annotated

class ProcessImageJobResponse(BaseModel):
    job_id: Annotated[str, Field(description="Unique identifier for job")]
    status: Annotated[JobStatus, Field(description="Job status")]
    status_uri: Annotated[str, Field(description="URI for checking the job status")]
    message: Annotated[str, Field(description="Message describing the job status")]

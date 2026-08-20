from typing import Annotated

from pydantic import BaseModel, Field, conint, constr


class PSOCResponse(BaseModel):
    id: Annotated[
        conint(ge=1),
        Field(description="Unique integer ID of the major group")
    ]

    majorcode: Annotated[
        conint(ge=1),
        Field(description="Major group code")
    ]

    title: Annotated[
        constr(strip_whitespace=True, min_length=1),
        Field(description="Title")
    ]

    description: Annotated[
        constr(strip_whitespace=True, min_length=1),
        Field(description="Description")
    ]

    version: Annotated[
        conint(ge=1),
        Field(description="Version")
    ]
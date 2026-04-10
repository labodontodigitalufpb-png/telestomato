from pydantic import BaseModel, Field, model_validator


class PathologyReportCreate(BaseModel):
    diagnosis: str = Field(..., min_length=3)
    report: str = Field(..., min_length=3)


class PathologyReportUpdate(BaseModel):
    diagnosis: str | None = Field(default=None, min_length=3)
    report: str | None = Field(default=None, min_length=3)

    @model_validator(mode="after")
    def validate_any_field(self):
        if not (self.diagnosis or self.report):
            raise ValueError("Envie ao menos diagnóstico ou laudo para edição.")
        return self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

LIST_LIMITS = {"industries": 10, "geographies": 15, "languages": 8, "job_titles": 15,
               "exclusions": 15}


def clean_list(values: object, max_items: int, max_len: int = 80) -> list[str]:
    """Trim, drop empties and over-long items, de-duplicate (case-insensitive), cap the length."""
    if values is None:
        return []
    if isinstance(values, str):
        values = [values]
    out: list[str] = []
    seen: set[str] = set()
    for v in values:  # type: ignore[union-attr]
        if not isinstance(v, str):
            continue
        v = " ".join(v.split())
        if not v or len(v) > max_len or v.lower() in seen:
            continue
        seen.add(v.lower())
        out.append(v)
    return out[:max_items]


class ICPCriteria(BaseModel):
    """The structured targeting criteria (README 11.1). Also the schema the LLM must return."""

    model_config = ConfigDict(extra="ignore")

    industries: list[str] = Field(default_factory=list)
    headcount_min: int | None = Field(default=None, ge=1, le=1_000_000)
    headcount_max: int | None = Field(default=None, ge=1, le=1_000_000)
    geographies: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    job_titles: list[str] = Field(default_factory=list)
    exclusions: list[str] = Field(default_factory=list)

    @field_validator(*LIST_LIMITS, mode="before")
    @classmethod
    def _tidy(cls, v: object, info) -> list[str]:
        return clean_list(v, LIST_LIMITS[info.field_name])

    @model_validator(mode="after")
    def _range_is_ordered(self) -> "ICPCriteria":
        lo, hi = self.headcount_min, self.headcount_max
        if lo is not None and hi is not None and lo > hi:
            raise ValueError("headcount_min cannot be greater than headcount_max")
        return self


REQUIRED_TO_CONFIRM = ("industries", "geographies", "job_titles")

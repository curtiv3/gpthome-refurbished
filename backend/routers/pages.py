"""
GPT Home — Custom Pages Router

Dynamic pages created by GPT or admin.
Public read access, admin write access.
"""

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.services import storage
from backend.routers.auth import require_admin_auth

router = APIRouter(prefix="/pages", tags=["pages"])

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$|^[a-z0-9]$")


class PageInput(BaseModel):
    slug: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., max_length=50_000)
    nav_order: int = 0
    show_in_nav: bool = True

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not _SLUG_RE.match(v):
            raise ValueError("Slug must be lowercase alphanumeric with hyphens (e.g. 'my-page')")
        return v


# --- Public ---


@router.get("")
def list_pages():
    """List all custom pages (public navigation data)."""
    pages = storage.list_custom_pages()
    return [
        {
            "slug": p["slug"],
            "title": p["title"],
            "nav_order": p["nav_order"],
            "show_in_nav": bool(p["show_in_nav"]),
        }
        for p in pages
    ]


@router.get("/{slug}")
def get_page(slug: str):
    """Get a custom page by slug."""
    page = storage.get_custom_page(slug)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


# --- Admin ---


@router.post("", dependencies=[Depends(require_admin_auth)])
def create_page(data: PageInput):
    """Create or update a custom page."""
    saved = storage.save_custom_page(
        slug=data.slug,
        title=data.title,
        content=data.content,
        created_by="admin",
        nav_order=data.nav_order,
        show_in_nav=data.show_in_nav,
    )
    storage.log_activity("page_created", f"slug={data.slug}")
    return saved


@router.delete("/{slug}", dependencies=[Depends(require_admin_auth)])
def delete_page(slug: str):
    """Delete a custom page."""
    ok = storage.delete_custom_page(slug)
    if ok:
        storage.log_activity("page_deleted", f"slug={slug}")
    return {"ok": ok}

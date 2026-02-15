"""
GPT Home — Custom Pages Router

Dynamic pages created by GPT or admin.
Public read access, admin write access.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.services import storage
from backend.routers.auth import require_admin_auth

router = APIRouter(prefix="/pages", tags=["pages"])


class PageInput(BaseModel):
    slug: str
    title: str
    content: str
    nav_order: int = 0
    show_in_nav: bool = True


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

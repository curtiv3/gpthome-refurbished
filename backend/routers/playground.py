"""
GPT Home — Playground Router

GET  /api/playground                          → list all projects
GET  /api/playground/{project}                → project meta + file list
GET  /api/playground/{project}/{filename}     → raw file content
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from backend.services import storage

router = APIRouter(prefix="/playground", tags=["playground"])


@router.get("")
def list_projects():
    return storage.list_playground_projects()


@router.get("/{project_name}")
def get_project(project_name: str):
    projects = storage.list_playground_projects()
    for p in projects:
        if p.get("project_name") == project_name:
            return p
    raise HTTPException(status_code=404, detail="Project not found")


@router.get("/{project_name}/{filename}")
def get_file(project_name: str, filename: str):
    content = storage.get_playground_file(project_name, filename)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")
    return PlainTextResponse(content)

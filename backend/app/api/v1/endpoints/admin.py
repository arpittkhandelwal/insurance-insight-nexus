"""Admin endpoint — reseed data, system info."""
from __future__ import annotations
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
import subprocess, sys

router = APIRouter()


class ReseedStatus(BaseModel):
    status: str
    message: str


@router.post("/reseed", response_model=ReseedStatus)
async def reseed_data(background_tasks: BackgroundTasks) -> ReseedStatus:
    """Re-run the data generator in the background. Used by Demo Mode reset."""
    def _run():
        subprocess.run(
            [sys.executable, "scripts/generate_data.py", "--out-dir", "data"],
            capture_output=True,
        )
    background_tasks.add_task(_run)
    return ReseedStatus(status="started", message="Data generation started in background (~60s)")


@router.get("/info")
async def system_info() -> dict:
    import platform
    return {
        "python": platform.python_version(),
        "platform": platform.system(),
        "version": "1.0.0",
        "environment": "local",
    }

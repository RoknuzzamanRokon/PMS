from __future__ import annotations

import os
import subprocess
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

router = APIRouter(tags=["deploy"])

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DEPLOY_SCRIPT_PATH = PROJECT_ROOT / "deploy.sh"


@router.post("/api/v1/live-project-push")
def live_project_push(x_deploy_token: str | None = Header(default=None)) -> dict:
    expected_token = os.getenv("DEPLOY_WEBHOOK_TOKEN")
    if not expected_token:
        raise HTTPException(status_code=500, detail="Deploy token is not configured.")
    if x_deploy_token != expected_token:
        raise HTTPException(status_code=403, detail="Invalid deploy token.")

    deploy_script_path = Path(os.getenv("DEPLOY_SCRIPT_PATH", DEFAULT_DEPLOY_SCRIPT_PATH))
    if not deploy_script_path.exists():
        raise HTTPException(status_code=404, detail=f"Deploy script not found: {deploy_script_path}")

    command = ["/bin/bash", str(deploy_script_path)]
    timeout_seconds = int(os.getenv("DEPLOY_SCRIPT_TIMEOUT_SECONDS", "900"))

    try:
        completed = subprocess.run(  # noqa: S603
            command,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(
            status_code=504,
            detail={
                "message": "Deploy script timed out.",
                "stdout": (exc.stdout or "")[-4000:],
                "stderr": (exc.stderr or "")[-4000:],
            },
        ) from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to start deploy script: {exc}") from exc

    payload = {
        "status": "success" if completed.returncode == 0 else "failed",
        "exit_code": completed.returncode,
        "stdout": completed.stdout[-4000:],
        "stderr": completed.stderr[-4000:],
    }
    if completed.returncode != 0:
        raise HTTPException(status_code=500, detail=payload)

    return payload

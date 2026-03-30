from __future__ import annotations

import os
import subprocess
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

router = APIRouter(tags=["deploy"])

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DEPLOY_SCRIPT_PATH = PROJECT_ROOT / "deploy.sh"
DEFAULT_DEPLOY_LOG_PATH = PROJECT_ROOT / "deploy.log"


def validate_deploy_token(x_deploy_token: str | None) -> None:
    expected_token = os.getenv("DEPLOY_WEBHOOK_TOKEN")
    if not expected_token:
        raise HTTPException(status_code=500, detail="Deploy token is not configured.")
    if x_deploy_token != expected_token:
        raise HTTPException(status_code=403, detail="Invalid deploy token.")


@router.post("/api/v1/live-project-push")
def live_project_push(x_deploy_token: str | None = Header(default=None)) -> dict:
    validate_deploy_token(x_deploy_token)

    deploy_script_path = Path(os.getenv("DEPLOY_SCRIPT_PATH", DEFAULT_DEPLOY_SCRIPT_PATH))
    if not deploy_script_path.exists():
        raise HTTPException(status_code=404, detail=f"Deploy script not found: {deploy_script_path}")

    deploy_log_path = Path(os.getenv("DEPLOY_LOG_PATH", DEFAULT_DEPLOY_LOG_PATH))
    command = f"nohup /bin/bash {deploy_script_path} > {deploy_log_path} 2>&1 &"

    try:
        completed = subprocess.run(  # noqa: S603
            ["/bin/bash", "-lc", command],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to start deploy script: {exc}") from exc

    if completed.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "failed_to_start",
                "exit_code": completed.returncode,
                "stdout": completed.stdout[-4000:],
                "stderr": completed.stderr[-4000:],
            },
        )

    return {
        "status": "started",
        "log_file": str(deploy_log_path),
        "stdout": completed.stdout[-4000:],
        "stderr": completed.stderr[-4000:],
    }


@router.get("/api/v1/live-project-push/status")
def live_project_push_status(x_deploy_token: str | None = Header(default=None)) -> dict:
    validate_deploy_token(x_deploy_token)

    deploy_log_path = Path(os.getenv("DEPLOY_LOG_PATH", DEFAULT_DEPLOY_LOG_PATH))
    if not deploy_log_path.exists():
        return {
            "status": "not_started",
            "log_file": str(deploy_log_path),
            "last_output": "",
        }

    log_text = deploy_log_path.read_text(encoding="utf-8", errors="replace")
    tail = log_text[-4000:]
    normalized_tail = tail.lower()

    if "deployment completed successfully" in normalized_tail or "deploy_success" in normalized_tail:
        status = "success"
    elif any(marker in normalized_tail for marker in ["error", "failed", "traceback"]):
        status = "failed"
    elif tail.strip():
        status = "running"
    else:
        status = "started"

    return {
        "status": status,
        "log_file": str(deploy_log_path),
        "last_output": tail,
    }

"""
Manual Code Upload Endpoints
— Upload a ZIP file and process it through the same pipeline as GitHub repos.
"""

import os
import shutil
import uuid
import zipfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks, Header, UploadFile, File, Form

from app.config import get_settings
from app.models.schemas import Repository, RepositoryResponse, APIResponse
from app.api.endpoints.auth import get_current_user
from app.api.endpoints.repositories import repositories_db
from app.services.persistence import save_repositories

router = APIRouter()
settings = get_settings()

# Max upload size: 100 MB
_MAX_UPLOAD_BYTES = 100 * 1024 * 1024

# Extensions used to guess the primary language
_LANG_EXTENSIONS: dict[str, str] = {
    ".py": "Python",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".jsx": "JavaScript",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".cpp": "C++",
    ".c": "C",
    ".cs": "C#",
    ".swift": "Swift",
    ".kt": "Kotlin",
}

_SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".next", "dist", "build",
    "venv", ".venv", ".tox", "vendor", "target", ".idea", ".vscode",
}


def _guess_language(root_path: str) -> Optional[str]:
    """Walk the extracted tree and return the most common source language."""
    counts: dict[str, int] = {}
    for dirpath, dirnames, filenames in os.walk(root_path):
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
        for fname in filenames:
            ext = os.path.splitext(fname)[1].lower()
            lang = _LANG_EXTENSIONS.get(ext)
            if lang:
                counts[lang] = counts.get(lang, 0) + 1
    if not counts:
        return None
    return max(counts, key=counts.get)  # type: ignore[arg-type]


async def _index_uploaded_repo(repo: Repository):
    """Run indexer on the uploaded project (same as GitHub clone post-step)."""
    try:
        from app.services.indexer import IndexerService
        indexer = IndexerService()
        await indexer.index_repository(repo)
        print(f"✅ Auto-indexed uploaded project {repo.name}")
    except Exception as e:
        print(f"⚠️ Auto-indexing failed for uploaded project {repo.name}: {e}")


@router.post("/upload-zip", response_model=RepositoryResponse)
async def upload_zip(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project_name: str = Form(""),
    description: str = Form(""),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """
    Upload a ZIP file containing a code project.
    The project is extracted to ./repos/ and indexed through the same
    pipeline used for GitHub repositories.
    """
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are accepted")

    # Read file content with size check
    contents = await file.read()
    if len(contents) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum size of {_MAX_UPLOAD_BYTES // (1024*1024)} MB",
        )

    # Prepare extraction directory
    repo_id = f"upload_{uuid.uuid4().hex[:12]}"
    repos_dir = settings.repos_directory
    os.makedirs(repos_dir, exist_ok=True)
    local_path = os.path.join(repos_dir, repo_id)

    try:
        # Write temp zip & extract
        zip_path = os.path.join(repos_dir, f"{repo_id}.zip")
        with open(zip_path, "wb") as f:
            f.write(contents)

        with zipfile.ZipFile(zip_path, "r") as zf:
            # Security: reject paths that escape the target directory
            for member in zf.namelist():
                resolved = os.path.realpath(os.path.join(local_path, member))
                if not resolved.startswith(os.path.realpath(local_path)):
                    raise HTTPException(
                        status_code=400, detail="ZIP contains unsafe path entries"
                    )
            zf.extractall(local_path)

        os.remove(zip_path)

        # If the ZIP had a single top-level directory, flatten it
        entries = os.listdir(local_path)
        if len(entries) == 1:
            single = os.path.join(local_path, entries[0])
            if os.path.isdir(single):
                temp_name = local_path + "_tmp"
                os.rename(single, temp_name)
                shutil.rmtree(local_path)
                os.rename(temp_name, local_path)

    except zipfile.BadZipFile:
        # Cleanup on bad zip
        if os.path.exists(local_path):
            shutil.rmtree(local_path)
        raise HTTPException(status_code=400, detail="Invalid or corrupted ZIP file")
    except HTTPException:
        raise
    except Exception as exc:
        if os.path.exists(local_path):
            shutil.rmtree(local_path)
        raise HTTPException(status_code=500, detail=f"Failed to extract ZIP: {exc}")

    # Derive project name from filename if not provided
    name = project_name.strip() or os.path.splitext(file.filename)[0]
    language = _guess_language(local_path)

    repo = Repository(
        id=repo_id,
        user_id=user.id,
        github_repo_id=0,
        name=name,
        full_name=f"{user.username}/{name}",
        description=description.strip() or None,
        default_branch="main",
        language=language,
        clone_url="",
        local_path=local_path,
        source="upload",
    )

    repositories_db[repo_id] = repo
    save_repositories(repositories_db)

    # Index in background (same pipeline as GitHub repos)
    background_tasks.add_task(_index_uploaded_repo, repo)

    return RepositoryResponse(
        id=repo.id,
        name=repo.name,
        full_name=repo.full_name,
        description=repo.description,
        language=repo.language,
        is_indexed=repo.is_indexed,
        indexed_at=repo.indexed_at,
        created_at=repo.created_at,
        source=repo.source,
    )

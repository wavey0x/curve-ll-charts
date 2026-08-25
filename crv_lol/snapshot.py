import json
import os
import tempfile
from pathlib import Path

REQUIRED_KEYS = (
    "ll_data",
    "last_updated",
    "chart_data",
    "treasury_balance_sheet",
    "curve_gauge_data",
    "curve_gauges_by_name",
)


def get_snapshot_path():
    configured = os.getenv("CRVLOL_SNAPSHOT_PATH")
    if not configured or not configured.strip():
        raise RuntimeError("CRVLOL_SNAPSHOT_PATH must be set")
    return Path(configured).expanduser()


def load_snapshot(path=None):
    snapshot_path = Path(path) if path is not None else get_snapshot_path()
    if not snapshot_path.exists():
        return {}
    with snapshot_path.open(encoding="utf-8") as snapshot_file:
        return json.load(snapshot_file)


def validate_snapshot(snapshot):
    missing = [key for key in REQUIRED_KEYS if key not in snapshot]
    if missing:
        raise ValueError(f"Snapshot is missing required keys: {', '.join(missing)}")
    if not isinstance(snapshot["last_updated"], (int, float)):
        raise ValueError("Snapshot last_updated must be numeric")
    for key in REQUIRED_KEYS:
        if key == "last_updated":
            continue
        if not isinstance(snapshot[key], dict) or not snapshot[key]:
            raise ValueError(f"Snapshot {key} must be a non-empty object")
    return snapshot


def publish_snapshot(snapshot, path=None):
    """Validate and atomically replace the public snapshot."""
    validate_snapshot(snapshot)
    snapshot_path = Path(path) if path is not None else get_snapshot_path()
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{snapshot_path.name}.",
        suffix=".tmp",
        dir=snapshot_path.parent,
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as temporary_file:
            json.dump(snapshot, temporary_file, indent=2)
            temporary_file.write("\n")
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.replace(temporary_name, snapshot_path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)

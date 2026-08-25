import json

import pytest

from crv_lol import snapshot


def valid_snapshot():
    return {
        "ll_data": {"locker": {}},
        "last_updated": 1,
        "chart_data": {"weekly_aprs": []},
        "treasury_balance_sheet": {"wallets": []},
        "curve_gauge_data": {"gauge": {}},
        "curve_gauges_by_name": {"name": {}},
    }


def test_snapshot_path_is_required(monkeypatch):
    monkeypatch.delenv("CRVLOL_SNAPSHOT_PATH", raising=False)

    with pytest.raises(RuntimeError, match="CRVLOL_SNAPSHOT_PATH must be set"):
        snapshot.get_snapshot_path()


def test_publish_snapshot_atomically_replaces_existing_file(tmp_path):
    destination = tmp_path / "snapshot.json"
    destination.write_text('{"old": true}\n', encoding="utf-8")

    snapshot.publish_snapshot(valid_snapshot(), destination)

    assert json.loads(destination.read_text(encoding="utf-8")) == valid_snapshot()
    assert list(tmp_path.glob("*.tmp")) == []


def test_failed_replace_preserves_existing_snapshot(tmp_path, monkeypatch):
    destination = tmp_path / "snapshot.json"
    original = '{"old": true}\n'
    destination.write_text(original, encoding="utf-8")

    def fail_replace(_source, _destination):
        raise OSError("simulated replace failure")

    monkeypatch.setattr(snapshot.os, "replace", fail_replace)

    with pytest.raises(OSError, match="simulated replace failure"):
        snapshot.publish_snapshot(valid_snapshot(), destination)

    assert destination.read_text(encoding="utf-8") == original


def test_invalid_snapshot_is_never_published(tmp_path):
    destination = tmp_path / "snapshot.json"

    with pytest.raises(ValueError, match="missing required keys"):
        snapshot.publish_snapshot({"ll_data": {}}, destination)

    assert not destination.exists()

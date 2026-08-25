from brownie import chain

from crv_lol.gauges import build_gauge_snapshot, fetch_curve_gauge_data
from crv_lol.liquid_lockers import (
    build_chart_data,
    build_liquid_locker_data,
)
from crv_lol.snapshot import get_snapshot_path, load_snapshot, publish_snapshot
from crv_lol.treasury import build_treasury_balance_sheet


def main():
    """Build every CRV.LOL resource and publish one atomic snapshot."""
    snapshot_path = get_snapshot_path()
    previous = load_snapshot(snapshot_path)
    candidate = dict(previous)

    liquid_lockers, timestamp = build_liquid_locker_data()
    candidate["ll_data"] = liquid_lockers
    candidate["last_updated"] = timestamp
    candidate["chart_data"] = build_chart_data(timestamp)

    gauge_data = fetch_curve_gauge_data()
    if gauge_data is not None:
        candidate.update(build_gauge_snapshot(gauge_data, chain.time()))
    elif not candidate.get("curve_gauge_data"):
        raise RuntimeError("No fresh or cached Curve gauge data is available")

    try:
        candidate["treasury_balance_sheet"] = build_treasury_balance_sheet()
    except Exception as error:
        if not candidate.get("treasury_balance_sheet"):
            raise
        print(f"Treasury refresh failed; preserving prior data: {error}")

    publish_snapshot(candidate, snapshot_path)
    print(f"Published CRV.LOL snapshot atomically to {snapshot_path}")


if __name__ == "__main__":
    main()

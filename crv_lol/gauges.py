import copy
import json
from datetime import datetime

import requests

CURVE_GAUGES_URL = "https://api.curve.finance/api/getAllGauges"


def fetch_curve_gauge_data():
    try:
        response = requests.get(CURVE_GAUGES_URL, timeout=30)
        response.raise_for_status()
        payload = response.json()
        if payload.get("success"):
            print(f"Fetched Curve gauge data at {datetime.now()}")
            return payload.get("data", {})
        print("Curve API returned success=false; preserving cached gauge data")
    except (requests.RequestException, json.JSONDecodeError) as error:
        print(f"Curve gauge fetch failed; preserving cached gauge data: {error}")
    return None


def build_gauge_snapshot(gauge_data, timestamp):
    filtered = {}
    by_name = {}

    for name, original in gauge_data.items():
        gauge = copy.deepcopy(original)
        if gauge.get("is_killed", False):
            continue
        gauge["curve_key"] = name
        gauge_address = gauge.get("gauge")
        if not gauge_address:
            continue
        filtered[gauge_address] = gauge
        controller = gauge.get("gauge_controller", {})
        gauge_state = gauge.get("gauge_data", {})
        inflation_rate = int(controller.get("inflation_rate", 0))
        gauge_weight = int(controller.get("get_gauge_weight", 0))
        working_supply = int(gauge_state.get("working_supply", 0))
        relative_weight = int(controller.get("gauge_relative_weight", 0))
        if gauge_weight == 0 or relative_weight == 0 or working_supply == 0:
            inflation_rate = 0
        by_name[name] = {
            "name": name,
            "gauge_address": gauge_address,
            "inflation_rate": inflation_rate,
        }

    if not filtered or not by_name:
        raise ValueError("Curve gauge response contained no usable gauges")

    return {
        "curve_gauge_data": filtered,
        "curve_gauges_by_name": by_name,
        "curve_gauge_data_last_updated": timestamp,
    }

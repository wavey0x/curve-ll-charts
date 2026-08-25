from copy import deepcopy
from datetime import datetime

from brownie import Contract, chain

import utils.utils as utils

DAY = 60 * 60 * 24
WEEK = DAY * 7
YEAR = DAY * 365
QUARTER = YEAR / 4
APR_SAMPLES = (30, 60, 90)
CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52"

CURVE_LIQUID_LOCKER_COMPOUNDERS = {
    "0xde2bEF0A01845257b4aEf2A2EAa48f6EAeAfa8B7": {
        "name": "Union Convex CRV",
        "symbol": "ucvxCRV",
        "underlying": "0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7",
        "pool": "0x971add32Ea87f10bD192671630be3BE8A11b8623",
        "color": "orange",
    },
    "0x27B5739e22ad9033bcBf192059122d163b60349D": {
        "name": "Staked Yearn CRV",
        "symbol": "yvyCRV",
        "underlying": "0xFCc5c47bE19d06BF83eB04298b026F81069ff65b",
        "pool": "0x99f5aCc8EC2Da2BC0771c32814EFF52b712de1E5",
        "color": "blue",
    },
    "0x43E54C2E7b3e294De3A155785F52AB49d87B9922": {
        "name": "Aladin StakeDao CRV",
        "symbol": "asdCRV",
        "underlying": "0xD1b5651E55D4CeeD36251c61c50C889B36F6abB5",
        "pool": "0xCA0253A98D16e9C1e3614caFDA19318EE69772D0",
        "color": "black",
    },
}


def build_liquid_locker_data():
    """Build the liquid-locker table without writing runtime state."""
    block = chain.height
    timestamp = chain.time()
    crv_price = utils.get_prices([CRV])[CRV]
    data = deepcopy(CURVE_LIQUID_LOCKER_COMPOUNDERS)

    for address, info in data.items():
        compounder = Contract(address)
        symbol = info["symbol"]
        fee_pct, profit_unlock_period, total_assets = get_compounder_data(
            compounder,
            symbol,
        )
        peg = get_peg(info["pool"], block)
        aprs = {
            sample: apr_for_period(compounder, sample)
            for sample in APR_SAMPLES
        }
        aprs_adjusted = {
            sample: apr_for_period(compounder, sample, adjust_for_peg=True)
            for sample in APR_SAMPLES
        }
        info.update(
            {
                "fee_pct": fee_pct,
                "profit_unlock_period": profit_unlock_period,
                "total_assets": total_assets,
                "peg": peg,
                "price": crv_price * peg,
                "tvl": crv_price * peg * total_assets,
                "aprs": aprs,
                "aprs_adjusted": aprs_adjusted,
            }
        )

    return data, timestamp


def get_compounder_data(compounder, symbol):
    if symbol == "ucvxCRV":
        return (
            compounder.platformFee() / compounder.FEE_DENOMINATOR() * 100,
            0,
            compounder.totalUnderlying() / 1e18,
        )
    if symbol == "yvyCRV":
        return (
            compounder.performanceFee() / 100,
            int(1e18 / compounder.lockedProfitDegradation()),
            compounder.totalAssets() / 1e18,
        )
    if symbol == "asdCRV":
        return (
            compounder.feeInfo()["platformPercentage"] / 1e7,
            compounder.rewardInfo()["periodLength"],
            compounder.totalAssets() / 1e18,
        )
    raise ValueError(f"Unsupported liquid locker: {symbol}")


def apr_for_period(locker, days_ago, adjust_for_peg=False):
    current_block, current_timestamp = get_block_and_timestamp(chain.time() - 1000)
    sample_block, sample_timestamp = get_block_and_timestamp(
        current_timestamp - (days_ago * DAY)
    )
    elapsed_time = current_timestamp - sample_timestamp
    address = locker if isinstance(locker, str) else locker.address
    start_pps = get_pps(address, sample_block)
    end_pps = get_pps(address, current_block)

    if start_pps == 0 or elapsed_time == 0:
        apr = 0
    else:
        apr = (end_pps - start_pps) / start_pps / (elapsed_time / YEAR)

    if adjust_for_peg:
        pool = CURVE_LIQUID_LOCKER_COMPOUNDERS[address]["pool"]
        apr *= get_peg(pool, sample_block) * get_peg(pool, current_block)

    return apr


def build_chart_data(timestamp):
    weekly = weekly_apr()
    since = apr_since()
    return {
        "weekly_aprs": _json_rows(weekly),
        "apr_since": _json_rows(since[1:] if len(since) > 1 else since),
        "last_updated": timestamp,
    }


def weekly_apr():
    current_week = (chain.time() - 5) // WEEK * WEEK
    samples = []
    for index in range(int(QUARTER // WEEK)):
        week_end = current_week - (WEEK * index)
        end_block, _ = get_block_and_timestamp(week_end)
        start_block = closest_block_before_timestamp(week_end - WEEK)
        end_pegs = get_peg_data_for_block(end_block)
        sample = {
            "date": datetime.fromtimestamp(week_end),
            "block": end_block,
            "start_block": start_block,
        }
        for info in CURVE_LIQUID_LOCKER_COMPOUNDERS.values():
            sample[f"{info['symbol']}_peg"] = end_pegs[info["symbol"]]
        for address, info in CURVE_LIQUID_LOCKER_COMPOUNDERS.items():
            sample[info["symbol"]] = calculate_apr(
                get_pps(address, start_block),
                get_pps(address, end_block),
                WEEK,
            )
        samples.append(sample)
    return samples


def apr_since():
    current_block, current_timestamp = get_block_and_timestamp(chain.time() - 1000)
    current_pegs = get_peg_data_for_block(current_block)
    samples = []
    for index in range(int(QUARTER // WEEK)):
        sample_block, sample_timestamp = get_block_and_timestamp(
            current_timestamp - (WEEK * index)
        )
        elapsed_time = current_timestamp - sample_timestamp
        sample = {
            "ts": sample_timestamp,
            "block": sample_block,
            "current_block": current_block,
            "date": datetime.fromtimestamp(sample_timestamp),
        }
        for info in CURVE_LIQUID_LOCKER_COMPOUNDERS.values():
            sample[f"{info['symbol']}_peg"] = current_pegs[info["symbol"]]
        for address, info in CURVE_LIQUID_LOCKER_COMPOUNDERS.items():
            sample[info["symbol"]] = calculate_apr(
                get_pps(address, sample_block),
                get_pps(address, current_block),
                elapsed_time,
            )
        samples.append(sample)
    return samples


def get_peg_data_for_block(block):
    return {
        info["symbol"]: get_peg(info["pool"], block)
        for info in CURVE_LIQUID_LOCKER_COMPOUNDERS.values()
    }


def calculate_apr(start_pps, end_pps, time_period):
    if start_pps == 0 or time_period == 0:
        return 0
    return (end_pps - start_pps) / start_pps / (time_period / YEAR)


def get_peg(pool_address, block):
    pool = Contract(pool_address)
    amount = 10_000e18
    return pool.get_dy(1, 0, amount, block_identifier=block) / amount


def get_pps(vault_address, block):
    vault = Contract(vault_address)
    symbol = CURVE_LIQUID_LOCKER_COMPOUNDERS[vault_address]["symbol"]
    if symbol == "yvyCRV":
        return vault.pricePerShare(block_identifier=block) / 1e18
    if symbol == "ucvxCRV":
        total_supply = vault.totalSupply(block_identifier=block)
        return vault.totalUnderlying(block_identifier=block) / total_supply
    try:
        return vault.convertToAssets(1e18, block_identifier=block) / 1e18
    except Exception:
        return 0


def get_block_and_timestamp(timestamp):
    block = closest_block_before_timestamp(timestamp)
    return block, chain[block].timestamp


def closest_block_before_timestamp(timestamp):
    low, high = 0, chain.height
    while high - low > 1:
        middle = (low + high) // 2
        if chain[middle].timestamp > timestamp:
            high = middle
        else:
            low = middle
    if chain[high].timestamp < timestamp:
        raise IndexError("timestamp is in the future")
    return low


def _json_rows(rows):
    return [
        {
            key: value.isoformat() if isinstance(value, datetime) else value
            for key, value in row.items()
        }
        for row in rows
    ]

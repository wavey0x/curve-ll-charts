from brownie import Contract, chain
from compounders_info import CURVE_LIQUID_LOCKER_COMPOUNDERS
import utils.utils as utils

DAY = 86400
YEAR = 365 * DAY
height = chain.height
ts = chain.time()

APR_SAMPLES = [30, 60, 90]
CRV = '0xD533a949740bb3306d119CC777fa900bA034cd52'

def update_info():
    crv_price = utils.get_prices([CRV])[CRV]
    data = CURVE_LIQUID_LOCKER_COMPOUNDERS

    for compounder, info in data.items():
        compounder = Contract(compounder)
        symbol = info['symbol']
        pool = info['pool']
        fee_pct, profit_unlock_period, total_assets = get_compounder_data(compounder, symbol)
        
        peg = get_peg(pool, height)
        price = crv_price * peg
        tvl = price * total_assets
        aprs = {sample: apr_since(compounder, sample) for sample in APR_SAMPLES}
        aprs_adjusted = {sample: apr_since(compounder, sample, adjust_for_peg=True) for sample in APR_SAMPLES}

        data[compounder.address].update({
            'fee_pct': fee_pct,
            'profit_unlock_period': profit_unlock_period,
            'total_assets': total_assets,
            'peg': peg,
            'price': price,
            'tvl': tvl,
            'aprs': aprs,
            'aprs_adjusted': aprs_adjusted
        })

    utils.cache_to_json('data/ll_info.json', {'ll_data': data, 'last_updated': ts})

def get_compounder_data(compounder, symbol):
    if symbol == 'ucvxCRV':
        return (compounder.platformFee() / compounder.FEE_DENOMINATOR() * 100, 0, compounder.totalUnderlying() / 1e18)
    if symbol == 'yvyCRV':
        return (compounder.performanceFee() / 100, int(1e18 / compounder.lockedProfitDegradation()), compounder.totalAssets() / 1e18)
    if symbol == 'asdCRV':
        return (compounder.feeInfo()['platformPercentage'] / 1e7, compounder.rewardInfo()['periodLength'], compounder.totalAssets() / 1e18)

def get_peg(pool, block):
    pool = Contract(pool)
    return pool.get_dy(1, 0, 10_000e18, block_identifier=block) / 10_000e18

def apr_since(locker, days_ago, adjust_for_peg=False):
    current_block, current_ts = get_block_and_ts(chain.time() - 1000)
    sample_block, sample_ts = get_block_and_ts(current_ts - (days_ago * DAY))
    elapsed_time = current_ts - sample_ts

    start_pps = get_pps(locker.address, sample_block)
    end_pps = get_pps(locker.address, current_block)
    gain = end_pps - start_pps
    apr = gain / start_pps / (elapsed_time / YEAR)

    if adjust_for_peg:
        data = CURVE_LIQUID_LOCKER_COMPOUNDERS[locker.address]
        peg_start = get_peg(data['pool'], sample_block)
        peg_end = get_peg(data['pool'], current_block)
        apr *= peg_start * peg_end

    return apr

def get_pps(vault_address, block):
    vault = Contract(vault_address)
    symbol = CURVE_LIQUID_LOCKER_COMPOUNDERS[vault_address]['symbol']

    if symbol == 'asdCRV':
        return vault.convertToAssets(1e18, block_identifier=block) / 1e18
    if symbol == 'yvyCRV':
        return vault.pricePerShare(block_identifier=block) / 1e18
    if symbol == 'ucvxCRV':
        ts = vault.totalSupply(block_identifier=block)
        total_underlying = vault.totalUnderlying(block_identifier=block)
        return total_underlying / ts

def get_block_and_ts(ts):
    block = closest_block_before_timestamp(ts)
    return block, chain[block].timestamp

def get_block_timestamp(height):
    return chain[height].timestamp

def closest_block_before_timestamp(timestamp):
    lo, hi = 0, chain.height
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if get_block_timestamp(mid) > timestamp:
            hi = mid
        else:
            lo = mid
    return hi if get_block_timestamp(hi) >= timestamp else lo

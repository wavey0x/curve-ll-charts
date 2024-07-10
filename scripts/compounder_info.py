from brownie import Contract, chain
from datetime import datetime, timedelta
from compounders_info import CURVE_LIQUID_LOCKER_COMPOUNDERS
import utils.utils as utils

DAY = 60 * 60 * 24
WEEK = DAY * 7
YEAR = DAY * 365
QUARTER = YEAR / 4
DATE_FORMAT = '%m-%d'
CLEAN_UP_CHARTS_OLDER_THAN_DAY = 10
height = chain.height
ts = chain.time()

def update_info():
    data = CURVE_LIQUID_LOCKER_COMPOUNDERS
    crv = '0xD533a949740bb3306d119CC777fa900bA034cd52'
    crv_price = utils.get_prices([crv])[crv]

    APR_SAMPLES = [30, 60 , 90]

    for compounder, info in CURVE_LIQUID_LOCKER_COMPOUNDERS.items():
        compounder = Contract(compounder)
        if info['symbol'] == 'ucvxCRV':
            data[compounder.address]['fee_pct'] = compounder.platformFee() / compounder.FEE_DENOMINATOR() * 100
            data[compounder.address]['total_assets'] = compounder.totalUnderlying() / 1e18
            peg = get_peg(data[compounder.address]['pool'], height)
            data[compounder.address]['peg'] = peg
            price = crv_price * peg
            data[compounder.address]['price'] = price
            data[compounder.address]['tvl'] = price * data[compounder.address]['total_assets']
            data[compounder.address]['aprs'] =  {sample: apr_since(compounder, sample) for sample in APR_SAMPLES}
            data[compounder.address]['aprs_adjusted'] =  {sample: apr_since(compounder, sample, adjust_for_peg=True) for sample in APR_SAMPLES}
            data[compounder.address]['profit_unlock_period'] = 0
        elif info['symbol'] == 'yvyCRV':
            data[compounder.address]['fee_pct'] = compounder.performanceFee() / 100
            data[compounder.address]['profit_unlock_period'] = int(1e18/compounder.lockedProfitDegradation())
            data[compounder.address]['total_assets'] = compounder.totalAssets() / 1e18
            peg = get_peg(data[compounder.address]['pool'], height)
            data[compounder.address]['peg'] = peg
            price = crv_price * peg
            data[compounder.address]['price'] = price
            data[compounder.address]['tvl'] = price * data[compounder.address]['total_assets']
            data[compounder.address]['aprs'] =  {sample: apr_since(compounder, sample) for sample in APR_SAMPLES}
            data[compounder.address]['aprs_adjusted'] =  {sample: apr_since(compounder, sample, adjust_for_peg=True) for sample in APR_SAMPLES}
        elif info['symbol'] == 'asdCRV':
            data[compounder.address]['fee_pct'] = compounder.feeInfo()['platformPercentage'] / 1e7
            data[compounder.address]['profit_unlock_period'] = compounder.rewardInfo()['periodLength']
            data[compounder.address]['total_assets'] = compounder.totalAssets() / 1e18
            peg = get_peg(data[compounder.address]['pool'], height)
            data[compounder.address]['peg'] = peg
            price = crv_price * peg
            data[compounder.address]['price'] = price
            data[compounder.address]['tvl'] = price * data[compounder.address]['total_assets']
            data[compounder.address]['aprs'] =  {sample: apr_since(compounder, sample) for sample in APR_SAMPLES}
            data[compounder.address]['aprs_adjusted'] =  {sample: apr_since(compounder, sample, adjust_for_peg=True) for sample in APR_SAMPLES}

    data = {
        'll_data': data,
        'last_updated': ts
    }
    utils.cache_to_json('data/ll_info.json', data)

def get_peg(pool, block):
    pool = Contract(pool)
    amount = 10_000e18
    return pool.get_dy(1, 0, amount, block_identifier=block) / amount

def apr_since(locker, days_ago, adjust_for_peg=False):
    locker = locker.address
    current_block, current_ts = get_block_and_ts(chain.time() - 1000)
    aprs = []
    peg = 1
    sample_block, sample_ts = get_block_and_ts(current_ts - (days_ago * DAY))
    elapsed_time = current_ts - sample_ts
    sample = {}
    data = CURVE_LIQUID_LOCKER_COMPOUNDERS[locker]
    start_pps = get_pps(locker, sample_block)
    end_pps = get_pps(locker, current_block)
    gain = end_pps - start_pps
    if adjust_for_peg:
        peg = get_peg(data['pool'], sample_block)
        peg *= get_peg(data['pool'], current_block)
    apr = gain / start_pps / (elapsed_time / YEAR) 
    return apr * peg

def get_pps(vault_address, block):
    vault = Contract(vault_address)
    symbol = CURVE_LIQUID_LOCKER_COMPOUNDERS[vault_address]['symbol']
    if symbol == 'asdCRV':
        return vault.convertToAssets(1e18, block_identifier=block) / 1e18
    elif symbol == 'yvyCRV':
        return vault.pricePerShare(block_identifier=block) / 1e18
    elif symbol == 'ucvxCRV':
        ts = vault.totalSupply(block_identifier=block)
        total_underlying = vault.totalUnderlying(block_identifier=block)
        return total_underlying / ts
    
def get_block_and_ts(ts):
    block = closest_block_before_timestamp(ts)
    return block, chain[block].timestamp

def get_block_timestamp(height):
    return chain[height].timestamp

def closest_block_before_timestamp(timestamp: int) -> int:
    height = chain.height
    lo, hi = 0, height
    while hi - lo > 1:
        mid = lo + (hi - lo) // 2
        if get_block_timestamp(mid) > timestamp:
            hi = mid
        else:
            lo = mid
    if get_block_timestamp(hi) < timestamp:
        raise IndexError('timestamp is in the future')

    return hi
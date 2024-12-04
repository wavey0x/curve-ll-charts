from brownie import Contract, chain
from compounders_info import CURVE_LIQUID_LOCKER_COMPOUNDERS
import utils.utils as utils

DAY = 86400
YEAR = 365 * DAY
height = chain.height
ts = chain.time()

APR_SAMPLES = [30, 60, 90]
CRV = '0xD533a949740bb3306d119CC777fa900bA034cd52'

CONCENTRATOR_VAULTS = [
    '0x2b95A1Dcc3D405535f9ed33c219ab38E8d7e0884',
    '0x43E54C2E7b3e294De3A155785F52AB49d87B9922',
    '0xb0903Ab70a7467eE5756074b31ac88aEBb8fB777',
    '0x07D1718fF05a8C53C8F05aDAEd57C0d672945f9a',
]

def compare_concentrator():
    import requests, json
    url = 'https://api.aladdin.club/api1/concentrator_aToken_tvl_apy'
    data = requests.get(url).json()['data']
    samples = {}
    days_ago = [10, 30, 60, 90]
    for symbol, info in data.items():
        if symbol == 'balances':
            continue
        samples[symbol] = {}
        samples[symbol]['reported'] = float(info['apy'])
        samples[symbol]['actual'] = {
            f'{days}_day': float(apr_since(info['address'], days, adjust_for_peg=False)) * 100 for days in days_ago
        }
    
    assert False

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

    locker = locker if isinstance(locker, str) else locker.address

    start_pps = get_pps(locker, sample_block)
    end_pps = get_pps(locker, current_block)
    gain = end_pps - start_pps
    if start_pps == 0 or elapsed_time == 0:
        apr = 0
    else:
        apr = gain / start_pps / (elapsed_time / YEAR)

    if adjust_for_peg:
        data = CURVE_LIQUID_LOCKER_COMPOUNDERS[locker]
        peg_start = get_peg(data['pool'], sample_block)
        peg_end = get_peg(data['pool'], current_block)
        peg = peg_end / peg_start
        peg_apr = (peg - 1) / (elapsed_time / YEAR)
        apr += peg_apr

    return apr

def get_pps(vault_address, block):
    vault = Contract(vault_address)

    symbol = ''
    if vault_address in CURVE_LIQUID_LOCKER_COMPOUNDERS:
        symbol = CURVE_LIQUID_LOCKER_COMPOUNDERS[vault_address]['symbol']

    if symbol == 'yvyCRV':
        return vault.pricePerShare(block_identifier=block) / 1e18
    elif symbol == 'ucvxCRV':
        ts = vault.totalSupply(block_identifier=block)
        total_underlying = vault.totalUnderlying(block_identifier=block)
        return total_underlying / ts
    else:
        # if vault.totalAssets(block_identifier=block) == 0:
        #     return 0
        try:
            return vault.convertToAssets(1e18, block_identifier=block) / 1e18
        except:
            return 0

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

from brownie import Contract, chain
import pandas as pd
import requests
from datetime import datetime, timedelta
from compounders_info import CURVE_LIQUID_LOCKER_COMPOUNDERS
import os
import glob
import json
from scripts.compounder_info import update_info
import utils.utils as utils

DAY = 60 * 60 * 24
WEEK = DAY * 7
YEAR = DAY * 365
QUARTER = YEAR / 4
DATE_FORMAT = '%m-%d'
CLEAN_UP_CHARTS_OLDER_THAN_DAY = 10


def main():
    update_info()
    if not os.path.exists('charts'):
        os.makedirs('charts')

    # Fetch Curve gauge data
    curve_gauge_data = fetch_curve_gauge_data()

    # Generate chart data
    aprs_weekly = weekly_apr()
    aprs_since = apr_since()

    # Save raw chart data and Curve gauge data to ll_info.json
    save_chart_data_to_cache(aprs_weekly, None, aprs_since, None, curve_gauge_data)

    # Generate Altair charts (keeping existing functionality)
    # plot_aprs('Weekly_APRs_False', aprs_weekly)
    # plot_aprs('APR_Since_False', aprs_since[1:])


def fetch_curve_gauge_data():
    """
    Fetch gauge data from Curve Finance API
    Returns dict with gauge data or None if failed
    """
    try:
        url = "https://api.curve.finance/api/getAllGauges"
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        if data.get('success'):
            print(f"✅ Successfully fetched Curve gauge data at {datetime.now()}")
            return data.get('data', {})
        else:
            print(f"❌ Curve API returned success=False")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching Curve gauge data: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing Curve API response: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error fetching Curve gauge data: {e}")
        return None


def get_peg_data_for_block(block):
    """
    Get peg data for all pools at a specific block
    Returns dict with pool symbols as keys and peg values as values
    """
    peg_data = {}
    for address, data in CURVE_LIQUID_LOCKER_COMPOUNDERS.items():
        peg_data[data['symbol']] = get_peg(data['pool'], block)
    return peg_data


def calculate_apr(start_pps, end_pps, time_period):
    """
    Calculate APR without peg adjustment
    """
    gain = end_pps - start_pps
    apr = gain / start_pps / (time_period / YEAR)
    return apr



def weekly_apr():
    current_time = chain.time() - 5
    current_week = current_time // WEEK * WEEK
    aprs = []
    sample_width = WEEK
    chart_width = QUARTER
    num_samples = int(chart_width // sample_width)
    
    for i in range(0, num_samples):
        week_end = current_week - (WEEK * i)
        end_block, _ = get_block_and_ts(week_end)
        start_block = closest_block_before_timestamp(week_end - WEEK)
        end_date = datetime.fromtimestamp(week_end)
        
        # Get peg data for current block only
        end_peg_data = get_peg_data_for_block(end_block)
        
        sample = {
            'date': end_date,
            'block': end_block,
            'start_block': start_block
        }
        
        # Add current peg data to sample
        for symbol in CURVE_LIQUID_LOCKER_COMPOUNDERS.values():
            sample[f"{symbol['symbol']}_peg"] = end_peg_data[symbol['symbol']]
        
        # Calculate APR for each compounder
        for address, data in CURVE_LIQUID_LOCKER_COMPOUNDERS.items():
            end_pps = get_pps(address, end_block)
            start_pps = get_pps(address, start_block)
            
            apr = calculate_apr(start_pps, end_pps, WEEK)
            
            sample[data['symbol']] = apr
        
        aprs.append(sample)
    
    return aprs


def apr_since():
    current_block, current_ts = get_block_and_ts(chain.time() - 1000)
    aprs = []
    sample_width = WEEK
    chart_width = QUARTER
    num_samples = int(chart_width // sample_width)
    
    for i in range(0, num_samples):
        sample_block, sample_ts = get_block_and_ts(current_ts - (sample_width * i))
        elapsed_time = current_ts - sample_ts
        
        # Get peg data for current block only
        current_peg_data = get_peg_data_for_block(current_block)
        
        dt_object = datetime.fromtimestamp(sample_ts)
        sample = {
            'ts': sample_ts,
            'block': sample_block,
            'current_block': current_block,
            'date': dt_object
        }
        
        # Add current peg data to sample
        for symbol in CURVE_LIQUID_LOCKER_COMPOUNDERS.values():
            sample[f"{symbol['symbol']}_peg"] = current_peg_data[symbol['symbol']]
        
        # Calculate APR for each compounder
        for address, data in CURVE_LIQUID_LOCKER_COMPOUNDERS.items():
            start_pps = get_pps(address, sample_block)
            end_pps = get_pps(address, current_block)
            
            apr = calculate_apr(start_pps, end_pps, elapsed_time)
            
            sample[data['symbol']] = apr
        
        aprs.append(sample)

    return aprs


def get_peg(pool, block):
    pool = Contract(pool)
    amount = 10_000e18
    return pool.get_dy(1, 0, amount, block_identifier=block) / amount


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



def save_chart_data_to_cache(aprs_weekly, aprs_weekly_peg, aprs_since, aprs_since_peg, curve_gauge_data=None):
    """
    Save raw chart data and Curve gauge data to ll_info.json cache for use with Recharts
    """
    # Load existing cache
    cache_data = utils.load_from_json('data/ll_info.json')
    if not cache_data:
        cache_data = {'ll_data': {}, 'last_updated': chain.time()}
    
    # Convert datetime objects to ISO strings for JSON serialization
    def convert_data_for_json(data_list):
        converted = []
        for item in data_list:
            converted_item = {}
            for key, value in item.items():
                if isinstance(value, datetime):
                    converted_item[key] = value.isoformat()
                else:
                    converted_item[key] = value
            converted.append(converted_item)
        return converted
    
    # Prepare chart data
    chart_data = {
        'weekly_aprs': convert_data_for_json(aprs_weekly),
        'apr_since': convert_data_for_json(aprs_since[1:] if len(aprs_since) > 1 else aprs_since),
        'last_updated': chain.time()
    }
    
    # Add chart data to cache
    cache_data['chart_data'] = chart_data
    
    # Add Curve gauge data to cache if available
    if curve_gauge_data:
        # Filter out killed gauges and restructure data
        filtered_gauge_data = {}
        curve_gauges_by_name = {}
        
        for key, gauge_info in curve_gauge_data.items():
            if not gauge_info.get('is_killed', False):
                # Add the original key as curve_key
                gauge_info['curve_key'] = key
                # Use the gauge address as the new key
                gauge_address = gauge_info.get('gauge')
                if gauge_address:
                    filtered_gauge_data[gauge_address] = gauge_info
                    inflation_rate = gauge_info.get('gauge_controller', {}).get('inflation_rate', '0')
                    gauge_weight = gauge_info.get('gauge_controller', {}).get('get_gauge_weight', '0')
                    if gauge_weight == 0:
                        inflation_rate = 0
                    curve_gauges_by_name[key] = {
                        'gauge': gauge_address,
                        'inflation_rate': inflation_rate
                    }
                else:
                    # Fallback to original key if no gauge address found
                    filtered_gauge_data[key] = gauge_info
                    curve_gauges_by_name[key] = {
                        'gauge': key,
                        'inflation_rate': inflation_rate
                    }
        
        cache_data['curve_gauge_data'] = filtered_gauge_data
        cache_data['curve_gauges_by_name'] = curve_gauges_by_name
        cache_data['curve_gauge_data_last_updated'] = chain.time()
        print(f"Curve gauge data added to cache at {datetime.now()} (filtered out killed gauges)")
    
    # Save updated cache
    utils.cache_to_json('data/ll_info.json', cache_data)
    print(f"Chart data saved to ll_info.json at {datetime.now()}")


def cleanup_old_charts(older_than_days):
    threshold_date = datetime.now() - timedelta(days=older_than_days)
    chart_files = glob.glob('charts/*.png')
    for file in chart_files:
        # Extract the date part from the filename
        file_date_str = '_'.join(file.split('_')[-2:]).replace('.png', '')
        try:
            file_date = datetime.strptime(file_date_str, '%Y-%m-%d_%H')
            if file_date < threshold_date:
                os.remove(file)
        except ValueError:
            # Skip files that don't match the expected format
            continue


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


if __name__ == "__main__":
    main()

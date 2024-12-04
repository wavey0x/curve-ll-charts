from brownie import Contract, chain
import pandas as pd
from datetime import datetime, timedelta
import altair as alt
from compounders_info import CURVE_LIQUID_LOCKER_COMPOUNDERS
import os
import glob
from scripts.compounder_info import update_info

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

    aprs_weekly = weekly_apr(adjust_for_peg=False)
    plot_aprs('Weekly_APRs_False', aprs_weekly)

    aprs_weekly_peg = weekly_apr(adjust_for_peg=True)
    plot_aprs('Weekly_APRs_True', aprs_weekly_peg)

    aprs_since = apr_since(adjust_for_peg=False)
    plot_aprs('APR_Since_False', aprs_since[1:])

    aprs_since_peg = apr_since(adjust_for_peg=True)
    plot_aprs('APR_Since_True', aprs_since_peg[1:])

def weekly_apr(adjust_for_peg=False):
    current_time = chain.time() - 5
    current_week = current_time // WEEK * WEEK
    aprs = []
    peg_apr = 0
    sample_width = WEEK
    chart_width = QUARTER
    num_samples = int(chart_width // sample_width)
    for i in range(0, num_samples):
        week_end = current_week - (WEEK * i)
        end_block, _ = get_block_and_ts(week_end)
        end_date = datetime.fromtimestamp(week_end)
        sample = {'date': end_date}
        for address, data in CURVE_LIQUID_LOCKER_COMPOUNDERS.items():
            end_pps = get_pps(address, end_block)
            start_block = closest_block_before_timestamp(week_end - WEEK)
            start_pps = get_pps(address, start_block)
            gain = end_pps - start_pps
            if adjust_for_peg:
                peg = get_peg(data['pool'], end_block)
                peg *= get_peg(data['pool'], start_block)
                peg_apr = (peg - 1) / (WEEK / YEAR)
            apr = gain / start_pps / (WEEK / YEAR)
            apr += peg_apr
            sample[data['symbol']] = apr
        aprs.append(sample)
    return aprs

def apr_since(adjust_for_peg=False):
    current_block, current_ts = get_block_and_ts(chain.time() - 1000)
    aprs = []
    peg_apr = 0
    sample_width = WEEK
    chart_width = QUARTER
    num_samples = int(chart_width // sample_width)
    for i in range(0, num_samples):
        sample_block, sample_ts = get_block_and_ts(current_ts - (sample_width * i))
        elapsed_time = current_ts - sample_ts
        sample = {}
        dt_object = datetime.fromtimestamp(sample_ts)
        sample['ts'] = sample_ts
        sample['block'] = sample_block
        sample['date'] = dt_object
        for address, data in CURVE_LIQUID_LOCKER_COMPOUNDERS.items():
            start_pps = get_pps(address, sample_block)
            end_pps = get_pps(address, current_block)
            gain = end_pps - start_pps
            if adjust_for_peg:
                peg = get_peg(data['pool'], sample_block)
                peg /= get_peg(data['pool'], current_block)
                peg_apr = (peg - 1) / (elapsed_time / YEAR)
            apr = gain / start_pps / (elapsed_time / YEAR) 
            apr += peg_apr
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
    

def plot_aprs(title, aprs):
    threshold_date = datetime.now()
    df = pd.DataFrame(aprs)
    df['date'] = pd.to_datetime(df['date'])

    # Filter data before the threshold date
    df = df[df['date'] < threshold_date]

    # Melt the dataframe for Altair
    melted_df = df.melt(id_vars=['date'], value_vars=['asdCRV', 'yvyCRV', 'ucvxCRV'], var_name='symbol', value_name='apr')

    # Adjust APR values by multiplying by 100
    melted_df['apr'] = melted_df['apr'] * 100

    # Define color mapping
    color_scale = alt.Scale(domain=['ucvxCRV', 'yvyCRV', 'asdCRV'],
                            range=['orange', '#4D8CC8', 'black'])

    # Dynamically set Y-axis based on the maximum APR value, with a bit of padding
    max_apr = melted_df['apr'].max()
    y_scale = alt.Scale(domain=[0, max_apr * 1.1])  # Add 10% padding to the top

    # Dynamically calculate the min and max dates for the X-axis domain
    min_date = melted_df['date'].min()
    max_date = melted_df['date'].max()
    x_scale = alt.Scale(domain=[min_date, max_date])

    # Create an Altair chart with smoothed lines using 'monotone' interpolation
    chart = alt.Chart(melted_df).mark_line(point=True, interpolate='monotone').encode(
        x=alt.X('date:T', title='Date', scale=x_scale, axis=alt.Axis(labelAngle=-45)),  # Apply dynamic X-scale
        y=alt.Y('apr:Q', title='% APR', scale=y_scale),  # Apply dynamic Y-scale
        color=alt.Color('symbol:N', scale=color_scale),
        tooltip=['date:T', 'symbol:N', alt.Tooltip('apr:Q', format='.2f')]
    ).properties(
        title=title,
        width='container',
        height=400  # Fixed height for responsiveness
    ).interactive(bind_x=False, bind_y=False)

    vertical_lines = pd.DataFrame({
        'date': [
            datetime.utcfromtimestamp(1718236800), 
            # datetime.utcfromtimestamp(1718841600)
        ],
        'label': [
            'Yearn YBS launch; Reward pause', 
            # 'YBS double rewards week start'
        ]
    })

    vlines = alt.Chart(vertical_lines).mark_rule(
        color='gray',
        strokeDash=[5, 5],
        size=2
    ).encode(
        x='date:T',
        tooltip=[alt.Tooltip('label:N', title=None)]
    )

    final_chart = alt.layer(chart, vlines).configure_axis(
        grid=True,
        gridOpacity=0.2,
        gridDash=[2, 2],
        gridColor='lightgray'
    ).configure_title(
        fontSize=20,
        font='Helvetica',
        anchor='middle',
        color='gray'
    ).configure_legend(
        titleFontSize=12,
        labelFontSize=10,
        symbolSize=100
    ).configure_view(
        strokeOpacity=0
    ).interactive()

    # Save chart as JSON with date
    date_str = datetime.now().strftime('%Y-%m-%d')
    filename = f"{title}_{date_str}.json"
    final_chart.save(os.path.join('charts', filename))
    print(os.path.join('charts', filename))
    # Clean up old charts
    # cleanup_old_charts(CLEAN_UP_CHARTS_OLDER_THAN_DAY)

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

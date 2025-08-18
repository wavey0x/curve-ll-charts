#!/usr/bin/env python3
"""
Test script to verify chart data caching functionality
"""

import json
import os
from datetime import datetime

def test_chart_data_cache():
    """Test if chart data is properly cached in ll_info.json"""
    
    # Check if ll_info.json exists
    if not os.path.exists('data/ll_info.json'):
        print("❌ data/ll_info.json not found")
        return False
    
    # Load the cache
    try:
        with open('data/ll_info.json', 'r') as f:
            cache_data = json.load(f)
    except Exception as e:
        print(f"❌ Error loading ll_info.json: {e}")
        return False
    
    # Check if chart_data exists
    if 'chart_data' not in cache_data:
        print("❌ chart_data not found in cache")
        return False
    
    chart_data = cache_data['chart_data']
    
    # Check required chart types
    required_charts = ['weekly_aprs', 'weekly_aprs_peg', 'apr_since', 'apr_since_peg']
    
    for chart_type in required_charts:
        if chart_type not in chart_data:
            print(f"❌ {chart_type} not found in chart_data")
            return False
        
        data = chart_data[chart_type]
        if not isinstance(data, list) or len(data) == 0:
            print(f"❌ {chart_type} has no data or invalid format")
            return False
        
        # Check data structure
        sample_item = data[0]
        required_fields = ['date', 'asdCRV', 'yvyCRV', 'ucvxCRV']
        
        for field in required_fields:
            if field not in sample_item:
                print(f"❌ {chart_type} missing field: {field}")
                return False
    
    print("✅ Chart data cache verification passed!")
    print(f"📊 Found {len(chart_data['weekly_aprs'])} weekly APR data points")
    print(f"📊 Found {len(chart_data['apr_since'])} APR since data points")
    print(f"🕒 Last updated: {datetime.fromtimestamp(cache_data['last_updated'])}")
    
    return True

def test_api_endpoint():
    """Test the API endpoint (requires Flask server to be running)"""
    import requests
    
    try:
        # Test the new chart data endpoint
        response = requests.get('http://localhost:5000/api/crvlol/chart-data/Weekly_APRs/false')
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API endpoint working! Received {len(data)} data points")
            if len(data) > 0:
                print(f"📊 Sample data point: {data[0]}")
            return True
        else:
            print(f"❌ API endpoint returned status {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to Flask server. Make sure it's running on localhost:5000")
        return False
    except Exception as e:
        print(f"❌ Error testing API endpoint: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Chart Data Caching System")
    print("=" * 50)
    
    # Test cache
    cache_ok = test_chart_data_cache()
    
    print("\n" + "=" * 50)
    
    # Test API endpoint
    api_ok = test_api_endpoint()
    
    print("\n" + "=" * 50)
    
    if cache_ok and api_ok:
        print("🎉 All tests passed! Chart data system is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")

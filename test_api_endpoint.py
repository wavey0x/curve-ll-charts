#!/usr/bin/env python3
"""
Test script to verify the local API endpoint is working
"""

import requests
import json

def test_local_api():
    """Test the local API endpoint"""
    
    base_url = "http://localhost:8000"
    
    # Test the chart data endpoint
    test_url = f"{base_url}/api/crvlol/chart-data/Weekly_APRs/false"
    
    try:
        print(f"Testing API endpoint: {test_url}")
        response = requests.get(test_url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API endpoint working! Received {len(data)} data points")
            if len(data) > 0:
                print(f"📊 Sample data point: {data[0]}")
            return True
        else:
            print(f"❌ API endpoint returned status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to Flask server. Make sure it's running on localhost:8000")
        return False
    except Exception as e:
        print(f"❌ Error testing API endpoint: {e}")
        return False

def test_production_api():
    """Test the production API endpoint for comparison"""
    
    base_url = "https://api.wavey.info"
    test_url = f"{base_url}/api/crvlol/chart-data/Weekly_APRs/false"
    
    try:
        print(f"\nTesting production API endpoint: {test_url}")
        response = requests.get(test_url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Production API working! Received {len(data)} data points")
            return True
        else:
            print(f"❌ Production API returned status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing production API: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing API Endpoints")
    print("=" * 50)
    
    # Test local API
    local_ok = test_local_api()
    
    # Test production API for comparison
    prod_ok = test_production_api()
    
    print("\n" + "=" * 50)
    
    if local_ok:
        print("🎉 Local API is working correctly!")
    else:
        print("⚠️  Local API is not working. Check if Flask server is running.")
    
    if prod_ok:
        print("ℹ️  Production API is also working (for reference).")

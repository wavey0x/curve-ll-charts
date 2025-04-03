/* global BigInt */
import React, { useState } from 'react';
import axios from 'axios';
import './GaugeSearch.css';

const GaugeSearch = () => {
  const [address, setAddress] = useState('');
  const [gaugeDetails, setGaugeDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showError, setShowError] = useState(false);

  // Validate Ethereum address format
  const isValidAddress = (value) => {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setAddress(value);
    setShowError(false);
  };

  // Calculate gauge inflation rate (CRV tokens per second)
  const calculateGaugeInflationRate = (weight, inflationRate) => {
    if (!weight || !inflationRate) return '0 CRV/sec';

    // Convert strings to BigInt
    const weightBig = BigInt(weight);
    const inflationBig = BigInt(inflationRate);

    // Total is 10^18
    const total = BigInt(10) ** BigInt(18);

    // Calculate gauge inflation rate
    // First convert the weight to a fraction (0-1)
    const weightFraction = Number(weightBig) / Number(total);

    // Then multiply by the inflation rate (which is in wei)
    const inflationValue = Number(inflationBig);

    // The result is the gauge-specific inflation rate in wei per second
    const gaugeInflationRateWei = weightFraction * inflationValue;

    // Convert from wei to CRV (divide by 10^18)
    const gaugeInflationRateCRV = gaugeInflationRateWei / Number(total);

    // Format with appropriate precision
    return gaugeInflationRateCRV.toFixed(8) + ' CRV/sec';
  };

  // Format percentage from wei
  const formatPercentage = (weiValue) => {
    if (!weiValue) return '0%';

    // Convert string to BigInt
    const wei = BigInt(weiValue);
    // Total is 10^18
    const total = BigInt(10) ** BigInt(18);

    // Calculate percentage (multiply by 100 for percentage)
    const percentage = (Number(wei) * 100) / Number(total);

    return percentage.toFixed(2) + '%';
  };

  // Determine color for boost value
  const getBoostColor = (boostValue) => {
    const boost = parseFloat(boostValue);

    if (boost >= 2.5) return '#4caf50'; // Green for 2.5x
    if (boost >= 1.75) return '#ffc107'; // Yellow for 1.75x
    return '#ff9800'; // Orange for lower values
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate the address format
    if (!isValidAddress(address)) {
      setError(
        'Please enter a valid Ethereum address (0x... format with 42 characters)'
      );
      setShowError(true);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setShowError(false);

      // Use environment variable for API base URL, with a fallback
      const apiBaseUrl =
        process.env.REACT_APP_API_BASE_URL || 'http://192.168.1.87:8000';
      console.log(`Using API base URL: ${apiBaseUrl}`);
      console.log(`Fetching gauge details for address: ${address}`);

      // Call the API endpoint with the base URL from environment variable
      const response = await axios.get(
        `${apiBaseUrl}/api/gauge?gauge=${address}`
      );

      if (response.data) {
        console.log('Successfully retrieved gauge details:', response.status);
        setGaugeDetails(response.data);
      } else {
        throw new Error('No data returned from API');
      }
    } catch (err) {
      setError(`Failed to fetch gauge details: ${err.message}`);
      setShowError(true);
      console.error('Error fetching gauge details:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gauge-search-container">
      <h1>Curve Gauge Search</h1>
      <p className="search-instructions">
        Enter a valid gauge address to view its details
      </p>

      <form onSubmit={handleSubmit} className="search-form">
        <input
          type="text"
          value={address}
          onChange={handleInputChange}
          placeholder="Enter gauge address (0x...)"
          className="search-input"
        />
        <button
          type="submit"
          className="search-button"
          disabled={loading || !address}
        >
          Search
        </button>
      </form>

      {showError && error && <div className="error">{error}</div>}

      {loading && <div className="loading">Loading gauge details...</div>}

      {gaugeDetails && !loading && gaugeDetails.data && (
        <div className="gauge-details">
          <h2>
            {gaugeDetails.data.pool_name || 'Gauge Details'}
            <span
              className={`verification-badge ${gaugeDetails.verification?.is_valid ? 'valid' : 'invalid'}`}
            >
              {gaugeDetails.verification?.is_valid ? '✓ Valid' : '✗ Invalid'}
            </span>
          </h2>

          <div className="details-grid">
            <div className="detail-card basic-info">
              <h3>Basic Information</h3>
              <div className="detail-item">
                <span className="label">Gauge Address:</span>
                <span className="value">{gaugeDetails.data.gauge_address}</span>
              </div>
              <div className="detail-item">
                <span className="label">Pool Address:</span>
                <span className="value">{gaugeDetails.data.pool_address}</span>
              </div>
              <div className="detail-item">
                <span className="label">Blockchain:</span>
                <span className="value">{gaugeDetails.data.blockchain}</span>
              </div>
              <div className="detail-item">
                <span className="label">Status:</span>
                <span className="value">
                  {gaugeDetails.data.is_killed ? 'Killed' : 'Active'}
                  {gaugeDetails.data.has_no_crv ? ' (No CRV)' : ''}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Verification:</span>
                <span
                  className={`value ${gaugeDetails.verification?.is_valid ? 'valid-text' : 'invalid-text'}`}
                >
                  {gaugeDetails.verification?.message}
                </span>
              </div>
            </div>

            <div className="detail-card weights">
              <h3>Gauge Weights</h3>
              <div className="detail-item">
                <span className="label">Current Weight:</span>
                <span className="value">
                  {formatPercentage(
                    gaugeDetails.data.gauge_controller?.gauge_relative_weight
                  )}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Future Weight:</span>
                <span className="value">
                  {formatPercentage(
                    gaugeDetails.data.gauge_controller
                      ?.gauge_future_relative_weight
                  )}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Gauge Inflation:</span>
                <span className="value">
                  {calculateGaugeInflationRate(
                    gaugeDetails.data.gauge_controller?.gauge_relative_weight,
                    gaugeDetails.data.gauge_controller?.inflation_rate
                  )}
                </span>
              </div>
            </div>

            {gaugeDetails.data.provider_boosts &&
              Object.keys(gaugeDetails.data.provider_boosts).length > 0 && (
                <div className="detail-card boosts">
                  <h3>Boost Providers</h3>
                  <div className="boost-providers">
                    {Object.entries(gaugeDetails.data.provider_boosts).map(
                      ([provider, boostData]) => (
                        <div className="boost-item" key={provider}>
                          <div className="provider-name">{provider}</div>
                          <div
                            className="boost-value"
                            style={{
                              backgroundColor: getBoostColor(
                                boostData.boost_formatted
                              ),
                            }}
                          >
                            {boostData.boost_formatted}x
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>

          <div className="raw-data-toggle">
            <details>
              <summary>Raw JSON Data</summary>
              <pre className="json-data">
                {JSON.stringify(gaugeDetails, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export default GaugeSearch;

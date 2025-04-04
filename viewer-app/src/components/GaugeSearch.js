/* global BigInt */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './GaugeSearch.css';

// Configure axios with default settings for CORS
const axiosInstance = axios.create({
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Helper function to retry API calls
const retryApiCall = async (apiCall, maxRetries = 3, delay = 1000) => {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;

      // Don't wait on the last attempt
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        // Increase delay for next retry (exponential backoff)
        delay *= 1.5;
      }
    }
  }

  // All retries failed
  throw lastError;
};

const GaugeSearch = () => {
  const [address, setAddress] = useState('');
  const [gaugeDetails, setGaugeDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showError, setShowError] = useState(false);
  const initialLoadDone = useRef(false);

  // Voting data state
  const [showVotes, setShowVotes] = useState(false);
  const [voteData, setVoteData] = useState([]);
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteError, setVoteError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Validate Ethereum address format - wrapped in useCallback to avoid recreating on each render
  const isValidAddress = useCallback((value) => {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setAddress(value);
    setShowError(false);
    // Hide votes when changing address
    setShowVotes(false);
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

    if (boost >= 2.0) return '#4caf50'; // Green for 2.0-2.5+
    if (boost >= 1.5) return '#ffc107'; // Yellow for 1.5-2.0
    return '#ff9800'; // Orange for 1.0-1.5
  };

  // Function to fetch gauge details - wrapped in useCallback to prevent infinite re-renders
  const fetchGaugeDetails = useCallback(
    async (gaugeAddress) => {
      if (!isValidAddress(gaugeAddress)) {
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
        let apiBaseUrl =
          process.env.REACT_APP_API_BASE_URL || 'http://192.168.1.87:8000';

        const urlWithoutTrailingSlash = apiBaseUrl.replace(/\/$/, '');
        const requestUrl = `${urlWithoutTrailingSlash}/api/gauge?gauge=${gaugeAddress}`;

        // Call the API endpoint with retry mechanism
        const response = await retryApiCall(() =>
          axiosInstance.get(requestUrl)
        );

        // Check if response contains valid gauge data
        if (
          response.data &&
          response.data.data &&
          Object.keys(response.data.data).length > 0
        ) {
          setGaugeDetails(response.data);
        } else {
          // API returned successfully but no gauge data was found
          throw new Error('Not a valid gauge address');
        }
      } catch (err) {
        // Try alternate URLs if the main one fails
        try {
          // Try a different URL structure as fallback
          const alternateBaseUrl = 'https://api.wavey.info';
          const alternateUrl = `${alternateBaseUrl}/api/gauge?gauge=${gaugeAddress}`;

          const alternateResponse = await retryApiCall(() =>
            axiosInstance.get(alternateUrl)
          );

          if (
            alternateResponse.data &&
            alternateResponse.data.data &&
            Object.keys(alternateResponse.data.data).length > 0
          ) {
            setGaugeDetails(alternateResponse.data);
            return; // Exit early if alternate URL works
          }
        } catch (alternateErr) {
          // Continue to main error handling
        }

        const errorMessage =
          err.message === 'Not a valid gauge address'
            ? 'Not a valid gauge address'
            : `Failed to fetch gauge details: ${err.message}`;

        setError(errorMessage);
        setShowError(true);
      } finally {
        setLoading(false);
      }
    },
    [isValidAddress]
  );

  // Function to fetch vote data for a gauge with retry mechanism
  const fetchVoteData = useCallback(
    async (page = 1) => {
      if (
        !gaugeDetails ||
        !gaugeDetails.data ||
        !gaugeDetails.data.gauge_address
      ) {
        setVoteError('No gauge details available');
        return;
      }

      setVoteLoading(true);
      setVoteError(null);

      try {
        const apiBaseUrl =
          process.env.REACT_APP_API_BASE_URL || 'http://192.168.1.87:8000';
        const requestUrl = `${apiBaseUrl}api/crvlol/gauge_votes`;

        console.log(`Making vote data API request to: ${requestUrl}`);
        console.log(`With parameters:`, {
          gauge: gaugeDetails.data.gauge_address,
          page: page,
        });

        // Use retry mechanism for vote data fetch
        const response = await retryApiCall(() =>
          axiosInstance.get(requestUrl, {
            params: { gauge: gaugeDetails.data.gauge_address, page },
          })
        );

        if (response.data.data.length === 0) {
          console.log('No votes found for this gauge');
          setVoteError('No votes found for this gauge');
          setVoteData([]);
        } else {
          console.log(
            `Successfully retrieved ${response.data.data.length} vote records`
          );
          console.log(
            `Total records: ${response.data.total}, Per page: ${response.data.per_page}`
          );
          setVoteData(response.data.data);
          setTotalPages(
            Math.ceil(response.data.total / response.data.per_page)
          );
          setCurrentPage(page);
        }
      } catch (err) {
        console.error('Vote fetch error details:', {
          message: err.message,
          stack: err.stack,
          response: err.response
            ? {
                status: err.response.status,
                data: err.response.data,
              }
            : 'No response',
          config: err.config
            ? {
                url: err.config.url,
                method: err.config.method,
              }
            : 'No config',
        });

        setVoteError('Error fetching vote data. Please try again.');
      } finally {
        setVoteLoading(false);
      }
    },
    [gaugeDetails]
  );

  // Toggle vote data visibility and fetch data if needed
  const toggleVoteData = () => {
    const newShowVotes = !showVotes;
    setShowVotes(newShowVotes);

    // Fetch vote data if showing votes and we haven't fetched them yet
    if (newShowVotes && voteData.length === 0 && !voteLoading) {
      fetchVoteData(1);
    }
  };

  // Formatting helpers for vote data
  const formatAddress = (address) => {
    if (address && address.length > 10) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address || '';
  };

  const formatNumber = (num) => {
    return Math.round(num).toLocaleString('en-US');
  };

  const formatWeight = (weight) => {
    return ((weight / 10000) * 100).toFixed(2) + '%';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getEtherscanLink = (address) =>
    `https://etherscan.io/address/${address}`;

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Update URL with the gauge address
    if (address) {
      const url = new URL(window.location);
      url.searchParams.set('gauge', address);
      window.history.pushState({}, '', url);
    }

    // Hide votes when changing address
    setShowVotes(false);
    setVoteData([]);

    await fetchGaugeDetails(address);
  };

  // Check for gauge address in URL on component mount - only run once
  useEffect(() => {
    // Skip if we've already processed the URL parameters
    if (initialLoadDone.current) return;

    const queryParams = new URLSearchParams(window.location.search);
    const gaugeAddress = queryParams.get('gauge');

    if (gaugeAddress) {
      setAddress(gaugeAddress);
      fetchGaugeDetails(gaugeAddress);
    }

    // Mark that we've processed the URL parameters
    initialLoadDone.current = true;
  }, [fetchGaugeDetails]);

  return (
    <div className="gauge-search-container">
      <h1>Curve Gauge Search</h1>

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
              <h3>Emissions</h3>

              <div className="weight-section">
                <h4 className="section-header">Current</h4>
                <div className="detail-item">
                  <span className="label">Inflation:</span>
                  <span className="value">
                    {calculateGaugeInflationRate(
                      gaugeDetails.data.gauge_controller?.gauge_relative_weight,
                      gaugeDetails.data.gauge_controller?.inflation_rate
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">Weight:</span>
                  <span className="value">
                    {formatPercentage(
                      gaugeDetails.data.gauge_controller?.gauge_relative_weight
                    )}
                  </span>
                </div>
                {gaugeDetails.data.apy_data?.gauge_crv_apy && (
                  <div className="detail-item">
                    <span className="label">APY:</span>
                    <span className="value">
                      {gaugeDetails.data.apy_data.gauge_crv_apy.min_boost?.toFixed(
                        2
                      ) || '0.00'}
                      % -{' '}
                      {gaugeDetails.data.apy_data.gauge_crv_apy.max_boost?.toFixed(
                        2
                      ) || '0.00'}
                      %
                    </span>
                  </div>
                )}
              </div>

              <div className="weight-section">
                <h4 className="section-header">Future</h4>
                <div className="detail-item">
                  <span className="label">Weight:</span>
                  <span className="value">
                    {formatPercentage(
                      gaugeDetails.data.gauge_controller
                        ?.gauge_future_relative_weight
                    )}
                  </span>
                </div>
                {gaugeDetails.data.apy_data?.gauge_future_crv_apy && (
                  <div className="detail-item">
                    <span className="label">APY:</span>
                    <span className="value">
                      {gaugeDetails.data.apy_data.gauge_future_crv_apy.min_boost?.toFixed(
                        2
                      ) || '0.00'}
                      % -{' '}
                      {gaugeDetails.data.apy_data.gauge_future_crv_apy.max_boost?.toFixed(
                        2
                      ) || '0.00'}
                      %
                    </span>
                  </div>
                )}
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

          <div className="votes-section">
            <div style={{ textAlign: 'center' }}>
              <button onClick={toggleVoteData} className="votes-toggle-button">
                <i className="fas fa-vote-yea"></i>{' '}
                {showVotes ? 'Hide Gauge Votes' : 'Show Gauge Votes'}
              </button>
            </div>

            {showVotes && (
              <div className="votes-content">
                <h3>Gauge Votes</h3>

                {voteLoading ? (
                  <div className="loading">Loading vote data...</div>
                ) : voteError ? (
                  <div className="error">{voteError}</div>
                ) : voteData.length > 0 ? (
                  <>
                    <div className="table-container">
                      <table className="vote-table">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th>Date</th>
                            <th className="weight-column">Weight</th>
                            <th className="amount-column">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {voteData.map((vote) => (
                            <tr key={vote.id}>
                              <td className="account-column">
                                <a
                                  href={getEtherscanLink(vote.account)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="black-link"
                                >
                                  {formatAddress(
                                    vote.account_alias || vote.account
                                  )}
                                </a>
                              </td>
                              <td>{formatDate(vote.date_str)}</td>
                              <td className="weight-column monospace">
                                {formatWeight(vote.weight)}
                              </td>
                              <td className="amount-column monospace">
                                {formatNumber(vote.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="pagination">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => fetchVoteData(currentPage - 1)}
                          className="page-button"
                        >
                          Previous
                        </button>
                        <span>
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => fetchVoteData(currentPage + 1)}
                          className="page-button"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="no-votes">No votes found for this gauge.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GaugeSearch;

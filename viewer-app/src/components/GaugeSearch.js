/* global BigInt */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './GaugeSearch.css';
import sha3 from 'crypto-js/sha3';
import Hex from 'crypto-js/enc-hex';

import FavoritesTable from './FavoritesTable';

// Configure axios with default settings for CORS
const axiosInstance = axios.create({
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Helper function to retry API calls
const retryApiCall = async (apiCall, maxRetries = 3, initialDelay = 1000) => {
  let lastError = null;
  let delay = initialDelay;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;

      // Don't wait on the last attempt
      if (attempt < maxRetries) {
        const currentDelay = delay;
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        // Increase delay for next retry (exponential backoff)
        delay *= 1.5;
      }
    }
  }

  // All retries failed
  throw lastError;
};

// Add this utility function near the top of your file, outside of the component
function toChecksumAddress(address) {
  if (
    !address ||
    typeof address !== 'string' ||
    !address.match(/^0x[0-9a-fA-F]{40}$/)
  ) {
    return address; // Return as is if invalid
  }

  address = address.toLowerCase();
  const chars = address.substring(2).split('');

  // Create a hash of the address using SHA3 (Keccak-256)
  const hash = sha3(address.slice(2), { outputLength: 256 });
  const addressHash = Hex.stringify(hash);

  let checksumAddress = '0x';
  for (let i = 0; i < chars.length; i++) {
    if (parseInt(addressHash[i], 16) >= 8) {
      checksumAddress += chars[i].toUpperCase();
    } else {
      checksumAddress += chars[i];
    }
  }

  return checksumAddress;
}

// Helper function to abbreviate addresses for display
function abbreviateAddress(address) {
  if (!address || typeof address !== 'string' || address.length < 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Function to fetch search suggestions
const fetchSearchSuggestions = async (query) => {
  if (!query || query.length < 2) {
    return {};
  }
  
  // Check if it's already a gauge address format - if so, skip search API
  if (query.match(/^0x[0-9a-fA-F]{40}$/i)) {
    return {};
  }
  
  try {
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'https://api.wavey.info';
    const urlWithoutTrailingSlash = apiBaseUrl.replace(/\/$/, '');
    const searchUrl = `${urlWithoutTrailingSlash}/api/gauge/search?q=${encodeURIComponent(query)}`;
    
    const response = await retryApiCall(() =>
      axiosInstance.get(searchUrl)
    );
    
    return response.data || {};
  } catch (error) {
    console.warn('Search suggestions failed:', error.message);
    return {};
  }
};

// Protocol mapping for icons (same as APRChart)
const protocolIcons = {
  asdCRV: {
    name: 'asdCRV',
    iconUrl: 'https://assets.coingecko.com/coins/images/13724/standard/stakedao_logo.jpg?1696513468',
  },
  yvyCRV: {
    name: 'yvyCRV', 
    iconUrl: 'https://assets.coingecko.com/coins/images/11849/standard/yearn.jpg?1696511720',
  },
  ucvxCRV: {
    name: 'ucvxCRV',
    iconUrl: 'https://assets.coingecko.com/coins/images/15585/standard/convex.png?1696515221',
  },
};

// Helper function to get protocol icon from provider name
const getProtocolIcon = (providerName) => {
  // Find matching protocol based on provider name
  for (const [key, protocol] of Object.entries(protocolIcons)) {
    if (providerName.toLowerCase().includes(key.toLowerCase())) {
      return protocol;
    }
  }
  return null;
};

const GaugeSearch = ({
  favorites,
  toggleFavorite,
  isFavorite,
  removeFavorite,
}) => {
  const [address, setAddress] = useState('');
  const [gaugeDetails, setGaugeDetails] = useState(null);
  const [verificationData, setVerificationData] = useState(null);
  const [boostData, setBoostData] = useState(null);
  const [loadingSteps, setLoadingSteps] = useState({
    basic: false,
    verification: false,
    boosts: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showError, setShowError] = useState(false);
  const initialLoadDone = useRef(false);
  const [copiedText, setCopiedText] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);

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
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Hide suggestions if empty or already a full address
    if (!value || value.length < 2 || value.match(/^0x[0-9a-fA-F]{40}$/i)) {
      setShowSuggestions(false);
      setSearchSuggestions({});
      return;
    }
    
    // Debounce search API calls
    const newTimeout = setTimeout(async () => {
      const suggestions = await fetchSearchSuggestions(value);
      setSearchSuggestions(suggestions);
      setShowSuggestions(Object.keys(suggestions).length > 0);
    }, 300);
    
    setSearchTimeout(newTimeout);
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

    // Format with 4 decimal places instead of 8
    return gaugeInflationRateCRV.toFixed(4) + ' CRV/sec';
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
        setGaugeDetails(null);
        setVerificationData(null);
        setBoostData(null);

        // Use environment variable for API base URL, with a fallback
        let apiBaseUrl =
          process.env.REACT_APP_API_BASE_URL || 'http://192.168.1.87:8000';
        const urlWithoutTrailingSlash = apiBaseUrl.replace(/\/$/, '');

        // Step 1: Fetch basic gauge data (fastest ~100-300ms)
        setLoadingSteps({ basic: true, verification: false, boosts: false });
        
        const basicUrl = `${urlWithoutTrailingSlash}/api/gauge/basic?gauge=${gaugeAddress}`;
        const basicResponse = await retryApiCall(() =>
          axiosInstance.get(basicUrl)
        );

        // Check if response contains valid gauge data
        if (
          basicResponse.data &&
          basicResponse.data.data &&
          Object.keys(basicResponse.data.data).length > 0
        ) {
          setGaugeDetails(basicResponse.data);
          setLoadingSteps(prev => ({ ...prev, basic: false }));
        } else {
          throw new Error('Not a valid gauge address');
        }

        // Step 2: Fetch verification data (medium ~1-2s) - run in parallel
        const verificationPromise = (async () => {
          try {
            setLoadingSteps(prev => ({ ...prev, verification: true }));
            const verificationUrl = `${urlWithoutTrailingSlash}/api/gauge/verification?gauge=${gaugeAddress}`;
            const verificationResponse = await retryApiCall(() =>
              axiosInstance.get(verificationUrl)
            );
            setVerificationData(verificationResponse.data);
          } catch (err) {
            console.warn('Verification data fetch failed:', err.message);
          } finally {
            setLoadingSteps(prev => ({ ...prev, verification: false }));
          }
        })();

        // Step 3: Fetch boost data (medium ~0.5-1s) - run in parallel
        const boostPromise = (async () => {
          try {
            setLoadingSteps(prev => ({ ...prev, boosts: true }));
            const boostUrl = `${urlWithoutTrailingSlash}/api/gauge/boosts?gauge=${gaugeAddress}`;
            const boostResponse = await retryApiCall(() =>
              axiosInstance.get(boostUrl)
            );
            setBoostData(boostResponse.data);
          } catch (err) {
            console.warn('Boost data fetch failed:', err.message);
          } finally {
            setLoadingSteps(prev => ({ ...prev, boosts: false }));
          }
        })();

        // Wait for both verification and boost data to complete
        await Promise.allSettled([verificationPromise, boostPromise]);

      } catch (err) {
        // Try alternate URLs if the main one fails
        try {
          const alternateBaseUrl = 'https://api.wavey.info';
          const alternateUrl = `${alternateBaseUrl}/api/gauge/basic?gauge=${gaugeAddress}`;

          const alternateResponse = await retryApiCall(() =>
            axiosInstance.get(alternateUrl)
          );

          if (
            alternateResponse.data &&
            alternateResponse.data.data &&
            Object.keys(alternateResponse.data.data).length > 0
          ) {
            setGaugeDetails(alternateResponse.data);
            setLoadingSteps({ basic: false, verification: false, boosts: false });
            
            // Also try alternate endpoints for verification and boost data
            Promise.allSettled([
              retryApiCall(() => axiosInstance.get(`${alternateBaseUrl}/api/gauge/verification?gauge=${gaugeAddress}`))
                .then(res => setVerificationData(res.data))
                .catch(err => console.warn('Alternate verification failed:', err.message)),
              retryApiCall(() => axiosInstance.get(`${alternateBaseUrl}/api/gauge/boosts?gauge=${gaugeAddress}`))
                .then(res => setBoostData(res.data))
                .catch(err => console.warn('Alternate boost data failed:', err.message))
            ]);
            
            return; // Exit early if alternate URL works
          }
        } catch (alternateErr) {
          // Continue to main error handling
        }

        const errorMessage =
          err.message === 'Not a valid gauge address'
            ? 'Not a valid gauge address'
            : `Failed to fetch gauge details: ${err.message}`;

        setGaugeDetails(null);
        setVerificationData(null);
        setBoostData(null);
        setLoadingSteps({ basic: false, verification: false, boosts: false });
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
        const urlWithoutTrailingSlash = apiBaseUrl.replace(/\/$/, '');
        const requestUrl = `${urlWithoutTrailingSlash}/api/crvlol/gauge_votes`;

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

  // Simplify the copyToClipboard function
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        // Success - just store the text that was copied for UI feedback
        setCopiedText(text);
        setTimeout(() => {
          setCopiedText('');
        }, 1500);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };

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

  // Handle gauge click from favorites table
  const handleGaugeClick = (gaugeAddress) => {
    setAddress(gaugeAddress);

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('gauge', gaugeAddress);
    window.history.pushState({}, '', url);

    // Fetch gauge details
    fetchGaugeDetails(gaugeAddress);
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
      {/* Favorites Table - moved to top */}
      <FavoritesTable
        favorites={favorites}
        onGaugeClick={handleGaugeClick}
        onRemoveFavorite={removeFavorite}
      />

      <div className="search-divider"></div>

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
          Search for gauge
        </button>
      </form>

      {showError && error && <div className="error">{error}</div>}

      {loading && !gaugeDetails && (
        <div className="loading-animated">
          <div className="loading-spinner">
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
          </div>
          Loading gauge details...
        </div>
      )}

      {gaugeDetails && gaugeDetails.data && (
        <div className="gauge-details">
          <div className="gauge-header-container">
            <h2 className="gauge-title">
              <button
                className={`favorite-button ${isFavorite(gaugeDetails.data.gauge_address) ? 'favorited' : ''}`}
                onClick={() => toggleFavorite(gaugeDetails)}
                title={
                  isFavorite(gaugeDetails.data.gauge_address)
                    ? 'Remove from favorites'
                    : 'Add to favorites'
                }
              >
                <i
                  className={`${isFavorite(gaugeDetails.data.gauge_address) ? 'fas' : 'far'} fa-star`}
                ></i>
              </button>
              {gaugeDetails.data.curve_key || gaugeDetails.data.pool_name || 'Gauge Details'}
            </h2>
          </div>

          <div className="details-grid">
            <div className="left-column">
              <div className="detail-card basic-info">
                <h3>Basic Information</h3>
                <div className="detail-item">
                  <span className="label">Gauge:</span>
                  <span className="value">
                    {abbreviateAddress(gaugeDetails.data.gauge_address)}
                    <button
                      className={`copy-button ${copiedText === gaugeDetails.data.gauge_address ? 'copied' : ''}`}
                      onClick={() =>
                        copyToClipboard(gaugeDetails.data.gauge_address)
                      }
                      title="Copy full address to clipboard"
                    >
                      <i
                        className={`fas ${copiedText === gaugeDetails.data.gauge_address ? 'fa-check' : 'fa-copy'}`}
                      ></i>
                    </button>
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">Pool:</span>
                  <span className="value">
                    {abbreviateAddress(gaugeDetails.data.pool_address)}
                    <button
                      className={`copy-button ${copiedText === gaugeDetails.data.pool_address ? 'copied' : ''}`}
                      onClick={() =>
                        copyToClipboard(gaugeDetails.data.pool_address)
                      }
                      title="Copy full address to clipboard"
                    >
                      <i
                        className={`fas ${copiedText === gaugeDetails.data.pool_address ? 'fa-check' : 'fa-copy'}`}
                      ></i>
                    </button>
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">Network:</span>
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
                  <span className="label">Verified:</span>
                  <span
                    className={`value ${
                      verificationData?.data?.verification?.is_valid ? 'valid-text' : 
                      verificationData !== null ? 'invalid-text' : ''
                    }`}
                  >
                    {verificationData === null 
                      ? (loadingSteps.verification ? (
                          <span style={{ color: '#666', fontSize: '12px' }}>
                            <span className="loading-dots">Loading</span>
                          </span>
                        ) : 'Unknown')
                      : verificationData.data?.verification?.is_valid ? (
                          <span 
                            style={{ fontWeight: 'bold', color: 'green' }}
                            title={verificationData.data?.verification?.message || ''}
                          >
                            VERIFIED
                          </span>
                        ) : (
                          <span 
                            style={{ fontWeight: 'bold', color: 'red' }}
                            title={verificationData.data?.verification?.message || ''}
                          >
                            NOT VERIFIED
                          </span>
                        )
                    }
                  </span>
                </div>
                {gaugeDetails.data.pool_urls?.deposit && (
                  <div className="detail-item">
                    <span className="label">Curve:</span>
                    <span className="value">
                      <a
                        href={gaugeDetails.data.pool_urls.deposit}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="curve-link"
                      >
                        <i className="fas fa-external-link-alt"></i>
                        View on Curve
                      </a>
                    </span>
                  </div>
                )}
              </div>

              {(boostData?.data?.provider_boosts &&
                Object.keys(boostData.data.provider_boosts).length > 0) || loadingSteps.boosts ? (
                  <div className="detail-card boosts">
                    <h3>Boost Providers</h3>
                    <div className="boost-providers">
                      {loadingSteps.boosts ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                          <div className="loading-spinner" style={{ margin: '0 auto 10px', transform: 'scale(0.8)' }}>
                            <div className="loading-dot"></div>
                            <div className="loading-dot"></div>
                            <div className="loading-dot"></div>
                          </div>
                          Loading boost data...
                        </div>
                      ) : boostData?.data?.provider_boosts ? (
                        Object.entries(boostData.data.provider_boosts)
                        .sort(([, a], [, b]) => parseFloat(b.boost_formatted) - parseFloat(a.boost_formatted))
                        .map(([provider, boostData]) => {
                          const boostValue = parseFloat(boostData.boost_formatted);
                          const fillPercentage = Math.max(0, Math.min(100, ((boostValue - 1.0) / (2.5 - 1.0)) * 100));
                          
                          // Color coding based on boost value ranges
                          let meterColor;
                          if (boostValue >= 2.0) {
                            meterColor = '#4caf50'; // Green for 2.0x+
                          } else if (boostValue >= 1.5) {
                            meterColor = '#ffc107'; // Yellow for 1.5x-1.99x
                          } else {
                            meterColor = '#ff5722'; // Red for 1.0x-1.49x
                          }
                          
                          return (
                            <div className="boost-item" key={provider}>
                              <div className="provider-name">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {(() => {
                                    const protocolIcon = getProtocolIcon(provider);
                                    return protocolIcon && (
                                      <img
                                        src={protocolIcon.iconUrl}
                                        alt={protocolIcon.name}
                                        style={{
                                          width: '16px',
                                          height: '16px',
                                          borderRadius: '50%',
                                          border: '1px solid #e0e0e0',
                                          objectFit: 'cover',
                                          flexShrink: 0,
                                        }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                    );
                                  })()}
                                  <span>
                                    {provider}
                                    {boostData.pct_of_total_supply && (
                                      <span className="tooltip-container">
                                        <span className="info-tooltip">i</span>
                                        <span className="tooltip-text">
                                          {boostData.pct_of_total_supply.toFixed(2)}% of
                                          staked
                                        </span>
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                              <div className="boost-value-container">
                                <div className="boost-meter">
                                  <div 
                                    className="boost-meter-fill"
                                    style={{
                                      width: `${fillPercentage}%`,
                                      backgroundColor: meterColor
                                    }}
                                  ></div>
                                </div>
                                <span className="boost-value-text">
                                  {boostData.boost_formatted}x
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                          No boost data available
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
            </div>

            <div className="detail-card weights">
              <h3>Emissions</h3>

              <div className="weight-section">
                <h4 className="section-header">Current</h4>
                <div className="detail-item">
                  <span className="label">Rate:</span>
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
                    <span className="label">APR:</span>
                    <span className="value">
                      {gaugeDetails.data.apy_data.gauge_crv_apy.min_boost?.toFixed(
                        2
                      ) || '0.00'}
                      % →{' '}
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
                  <span className="label">Rate:</span>
                  <span className="value">
                    {calculateGaugeInflationRate(
                      gaugeDetails.data.gauge_controller
                        ?.gauge_future_relative_weight,
                      gaugeDetails.data.gauge_controller?.inflation_rate
                    )}
                  </span>
                </div>
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
                    <span className="label">APR:</span>
                    <span className="value">
                      {gaugeDetails.data.apy_data.gauge_future_crv_apy.min_boost?.toFixed(
                        2
                      ) || '0.00'}
                      % →{' '}
                      {gaugeDetails.data.apy_data.gauge_future_crv_apy.max_boost?.toFixed(
                        2
                      ) || '0.00'}
                      %
                    </span>
                  </div>
                )}
              </div>
            </div>
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
                  <div className="loading-centered">Loading vote data...</div>
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

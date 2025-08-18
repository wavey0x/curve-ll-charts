import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Dao.css';

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
      if (attempt < maxRetries) {
        const currentDelay = delay;
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        delay *= 1.5; // Exponential backoff
      }
    }
  }
  throw lastError;
};

const Dao = () => {
  const [governanceVotes, setGovernanceVotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getEtherscanLink = (address) =>
    `https://etherscan.io/address/${address}`;

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const fetchGovernanceVotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBaseUrl =
        process.env.REACT_APP_API_BASE_URL || 'http://192.168.1.87:8000';
      const response = await retryApiCall(() =>
        axiosInstance.get(`${apiBaseUrl}/api/crvlol/gov_proposals`)
      );
      setGovernanceVotes(response.data.data);
    } catch (err) {
      setError('Failed to fetch governance votes');
      console.error('Error fetching governance votes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGovernanceVotes();
  }, [fetchGovernanceVotes]);

  return (
    <div className="dao-container">
      <h1>Curve DAO Gauge Validator</h1>
      <br />
      <br />
      <div className="governance-votes-section">
        <h2>Active Proposals</h2>
        {loading ? (
          <div className="loading">Loading active proposals...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <ul className="governance-votes-list">
            {governanceVotes.map((vote) => (
              <li
                key={vote.id}
                className={`governance-vote-item ${vote.gauges.length === 0 ? 'empty' : ''}`}
              >
                <div className="proposal-main">
                  <a
                    href={`https://www.curve.finance/dao/ethereum/proposals/${vote.id}-ownership`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="governance-vote-link"
                  >
                    #{vote.id}
                  </a>
                  {vote.gauges.length > 0 ? (
                    vote.isValid ? (
                      <span className="valid-emoji">✅</span>
                    ) : (
                      <span className="invalid-emoji">❌</span>
                    )
                  ) : null}
                </div>
                {vote.gauges.length > 0 && (
                  <div className="gauges-list">
                    <div className="gauges-label">Gauges:</div>
                    {vote.gauges.map((gauge) => (
                      <a
                        key={gauge}
                        href={getEtherscanLink(gauge)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gauge-link"
                      >
                        {formatAddress(gauge)}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      This page shows all active Curve governance proposals. If a proposal
      contains actions to add gauge(s) to the gauge controller, those addresses
      are validated to ensure they've been deployed by a trusted factory. Data
      is fetched on chain from my{' '}
      <a
        href="https://etherscan.io/address/0x60272833edd3f340f6436a8aaa83290c61524c44#code"
        target="_blank"
        rel="noopener noreferrer"
      >
        gauge validator
      </a>{' '}
      contract. It does not validate the LP token.
    </div>
  );
};

export default Dao;

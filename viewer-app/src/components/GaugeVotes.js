import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './GaugeVotes.css'; // We'll create this file for custom styles

const GaugeVotes = () => {
  const [gaugeAddress, setGaugeAddress] = useState('');
  const [voteData, setVoteData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [allGauges, setAllGauges] = useState(null);
  const [matchedGauge, setMatchedGauge] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const fetchAllGauges = async () => {
      try {
        const response = await axios.get(
          'https://api.curve.fi/api/getAllGauges'
        );
        setAllGauges(response.data.data);
      } catch (error) {
        console.error('Error fetching all gauges:', error);
      }
    };
    fetchAllGauges();
  }, []);

  const fetchVoteData = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      setVoteData([]);

      if (allGauges) {
        const matchedGaugeEntry = Object.entries(allGauges).find(
          ([_, gaugeData]) =>
            gaugeData.gauge.toLowerCase() === gaugeAddress.toLowerCase()
        );
        if (matchedGaugeEntry) {
          const fullName = matchedGaugeEntry[1].name;
          const nameWithoutAddress = fullName.split(' (')[0];
          setMatchedGauge({
            name: nameWithoutAddress,
            address: matchedGaugeEntry[1].gauge,
          });
        }
      }

      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_BASE_URL}/crvlol/gauge_votes`,
          {
            params: { gauge: gaugeAddress, page },
          }
        );
        setVoteData(response.data.data);
        setTotalPages(Math.ceil(response.data.total / response.data.per_page));
        setCurrentPage(page);
      } catch (error) {
        setError('Error fetching vote data. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [gaugeAddress, allGauges]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchVoteData(1);
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

  return (
    <div className="gauge-votes">
      <h1>Gauge Votes</h1>
      <Link to="/" className="black-link">
        Back to Home
      </Link>

      <form onSubmit={handleSubmit} className="gauge-form">
        <input
          type="text"
          placeholder="Enter gauge address"
          value={gaugeAddress}
          onChange={(e) => setGaugeAddress(e.target.value)}
          className="gauge-input"
        />
        <button type="submit" className="submit-button">
          Submit
        </button>
      </form>

      {matchedGauge && (
        <p>
          Showing results for{' '}
          <a
            href={getEtherscanLink(matchedGauge.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="black-link"
          >
            {matchedGauge.name}
          </a>
        </p>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : voteData.length > 0 ? (
        <>
          <table className="vote-table">
            <thead>
              <tr>
                <th>Account</th>
                <th className="amount-column">Amount</th>
                <th>Date</th>
                <th className="weight-column">Weight</th>
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
                      {vote.account_alias || vote.account}
                    </a>
                  </td>
                  <td className="amount-column monospace">
                    {formatNumber(vote.amount)}
                  </td>
                  <td>{formatDate(vote.date_str)}</td>
                  <td className="weight-column monospace">
                    {formatWeight(vote.weight)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        </>
      ) : null}
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default GaugeVotes;

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Data.css';

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL, // Specify the Flask server URL and port
});

const Data = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCrvApr, setShowCrvApr] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axiosInstance.get('/info');
        setData(response.data.ll_data || {});
        setLoading(false);
      } catch (error) {
        console.error('Error fetching the data:', error);
        setData({});
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!data || Object.keys(data).length === 0) {
    return <p>Error fetching data.</p>;
  }

  const formatPercentage = (value) => `${(value * 100).toFixed(2)}%`;
  const formatCurrency = (value) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatHours = (seconds) =>
    seconds ? (seconds / 3600).toFixed(2) : '0';

  const getBoldClass = (isBold) => (isBold ? 'bold' : '');

  const extractData = (field) => {
    return Object.values(data).map((locker) => locker[field]);
  };

  const findHighestValue = (values) => {
    return Math.max(...values);
  };

  const findLowestValue = (values) => {
    return Math.min(...values);
  };

  const renderTable = (field) => {
    const rows = Object.keys(data).map((key) => {
      const locker = data[key];
      return {
        symbol: locker.symbol,
        30: locker[field]?.['30'] || 0,
        60: locker[field]?.['60'] || 0,
        90: locker[field]?.['90'] || 0,
      };
    });

    const highest30 = findHighestValue(rows.map((row) => row['30']));
    const highest60 = findHighestValue(rows.map((row) => row['60']));
    const highest90 = findHighestValue(rows.map((row) => row['90']));

    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>30 Day APR</th>
            <th>60 Day APR</th>
            <th>90 Day APR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{row.symbol}</td>
              <td className={getBoldClass(row['30'] === highest30)}>
                {formatPercentage(row['30'])}
              </td>
              <td className={getBoldClass(row['60'] === highest60)}>
                {formatPercentage(row['60'])}
              </td>
              <td className={getBoldClass(row['90'] === highest90)}>
                {formatPercentage(row['90'])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderTvlTable = () => {
    const rows = Object.keys(data).map((key) => {
      const locker = data[key];
      return {
        symbol: locker.symbol,
        tvl: locker.tvl || 0,
        profit_unlock_period: locker.profit_unlock_period || 0,
        fee: locker.fee_pct || 0,
      };
    });

    const highestTvl = findHighestValue(rows.map((row) => row.tvl));
    const lowestFee = findLowestValue(rows.map((row) => row.fee));

    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>TVL</th>
            <th>Profit Unlock Period (Hours)</th>
            <th>Fee</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{row.symbol}</td>
              <td className={getBoldClass(row.tvl === highestTvl)}>
                {formatCurrency(row.tvl)}
              </td>
              <td>{formatHours(row.profit_unlock_period)}</td>
              <td className={getBoldClass(row.fee === lowestFee)}>
                {formatPercentage(row.fee / 100)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <div className="toggle-switch">
        <label>
          <span className="label-text">Denominate in CRV</span>
          <input
            type="checkbox"
            checked={showCrvApr}
            onChange={() => setShowCrvApr(!showCrvApr)}
          />
          <span className="slider"></span>
        </label>
      </div>
      <h4>APRs {showCrvApr ? '(CRV Denominated)' : ''}</h4>
      {!showCrvApr && renderTable('aprs')}

      {showCrvApr && renderTable('aprs_adjusted')}
      <h4>Other</h4>
      {renderTvlTable()}
    </div>
  );
};

export default Data;

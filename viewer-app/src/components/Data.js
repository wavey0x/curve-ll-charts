import React, { useEffect, useState } from 'react';
import axios from 'axios';
import APRChart from './APRChart';
import HarvestTable from './HarvestTable';
import './Data.css';

const axiosInstance = axios.create({
  baseURL: 'https://api.wavey.info/',
});

const Data = () => {
  const [data, setData] = useState(null);
  const [sinceData, setSinceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [harvestsCollapsed, setHarvestsCollapsed] = useState(true);

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

  // Helper function to get protocol icon from symbol
  const getProtocolIcon = (symbol) => {
    // Find matching protocol based on symbol
    for (const [key, protocol] of Object.entries(protocolIcons)) {
      if (symbol.toLowerCase().includes(key.toLowerCase())) {
        return protocol;
      }
    }
    return null;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axiosInstance.get('api/crvlol/info');
        setData(response.data.ll_data || {});
        
        // Process chart data
        const chartData = response.data.chart_data;
        if (chartData && chartData.apr_since && Array.isArray(chartData.apr_since)) {
          const sinceChartData = chartData.apr_since
            .map((item) => ({
              date: new Date(item.date).getTime(),
              asdCRV: item.asdCRV * 100,
              yvyCRV: item.yvyCRV * 100,
              ucvxCRV: item.ucvxCRV * 100,
            }))
            .sort((a, b) => a.date - b.date);
          setSinceData(sinceChartData);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching the data:', error);
        setData({});
        setSinceData([]);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="loading-centered">Loading...</div>;
  }

  if (!data || Object.keys(data).length === 0) {
    return <p>Error fetching data.</p>;
  }

  const formatPercentage = (value) => `${(value * 100).toFixed(2)}%`;
  const formatCurrency = (value) => {
    const millions = value / 1000000;
    return `$${millions.toFixed(2)}M`;
  };
  const formatHours = (seconds) =>
    seconds ? (seconds / 3600).toFixed(2) : '0';

  const getBoldClass = (isBold) => (isBold ? 'bold' : '');

  const findHighestValue = (values) => {
    return Math.max(...values);
  };

  const findLowestValue = (values) => {
    return Math.min(...values);
  };

  const renderCombinedTable = () => {
    const rows = Object.keys(data).map((key) => {
      const locker = data[key];
      return {
        symbol: locker.symbol,
        apr30: locker.aprs?.['30'] || 0,
        apr60: locker.aprs?.['60'] || 0,
        apr90: locker.aprs?.['90'] || 0,
        tvl: locker.tvl || 0,
      };
    });

    // Calculate the average APR for each row and sort by it
    const sortedRows = rows
      .map((row) => ({
        ...row,
        averageAPR: (row.apr30 + row.apr60 + row.apr90) / 3,
      }))
      .sort((a, b) => b.averageAPR - a.averageAPR);

    // Find highest/best values for highlighting
    const highest30 = findHighestValue(sortedRows.map((row) => row.apr30));
    const highest60 = findHighestValue(sortedRows.map((row) => row.apr60));
    const highest90 = findHighestValue(sortedRows.map((row) => row.apr90));
    const highestTvl = findHighestValue(sortedRows.map((row) => row.tvl));

    return (
      <table className="data-table combined-table">
        <thead>
          <tr>
            <th>Protocol</th>
            <th>30D APR</th>
            <th>60D APR</th>
            <th>90D APR</th>
            <th>TVL</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => {
            const protocolIcon = getProtocolIcon(row.symbol);
            return (
              <tr key={index}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {protocolIcon && (
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
                    )}
                    {row.symbol}
                  </div>
                </td>
                <td className={getBoldClass(row.apr30 === highest30)}>
                  {formatPercentage(row.apr30)}
                </td>
                <td className={getBoldClass(row.apr60 === highest60)}>
                  {formatPercentage(row.apr60)}
                </td>
                <td className={getBoldClass(row.apr90 === highest90)}>
                  {formatPercentage(row.apr90)}
                </td>
                <td className={getBoldClass(row.tvl === highestTvl)}>
                  {formatCurrency(row.tvl)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };


  return (
    <div className="data-container">
      <APRChart data={sinceData} title="APR Since" height={400} />
      
      <div className="table-divider"></div>
      
      {renderCombinedTable()}
      
      <div className="harvest-section">
        <div 
          className="harvest-header"
          onClick={() => setHarvestsCollapsed(!harvestsCollapsed)}
        >
          <h3>
            Harvest History
            <i className={`fas fa-chevron-down collapse-arrow ${harvestsCollapsed ? 'collapsed' : ''}`}></i>
          </h3>
        </div>
        {!harvestsCollapsed && (
          <div className="harvest-content">
            <HarvestTable />
          </div>
        )}
      </div>
    </div>
  );
};

export default Data;

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import './HarvestTable.css';

const axiosInstance = axios.create({
  baseURL:
    process.env.NODE_ENV === 'production'
      ? `${process.env.REACT_APP_API_BASE_URL}`
      : process.env.REACT_APP_API_BASE_URL,
});

const HarvestTable = () => {
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1); // Total number of pages
  const [filterName, setFilterName] = useState('');
  const [sortField, setSortField] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const perPage = 30;

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

  // Helper function to get protocol icon from harvest name
  const getProtocolIcon = (harvestName) => {
    // Map harvest names to protocol keys
    const nameMapping = {
      'asdCRV': 'asdCRV',
      'yvyCRV': 'yvyCRV', 
      'ucvxCRV': 'ucvxCRV',
    };
    
    // Find matching protocol
    for (const [key, protocol] of Object.entries(protocolIcons)) {
      if (harvestName.toLowerCase().includes(key.toLowerCase())) {
        return protocol;
      }
    }
    
    return null;
  };

  useEffect(() => {
    const fetchHarvests = async () => {
      setLoading(true);
      try {
        const response = await axiosInstance.get(
          `/api/crvlol/harvests?page=${page}&per_page=${perPage}`
        );
        setHarvests(response.data.data);
        setTotalPages(Math.ceil(response.data.total / perPage)); // Assuming response.data.total gives the total number of items
        setLoading(false);
      } catch (error) {
        console.error('Error fetching the harvests:', error);
        setLoading(false);
      }
    };

    fetchHarvests();
  }, [page]);

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleFilterChange = (selectedOption) => {
    setFilterName(selectedOption ? selectedOption.value : '');
  };

  const handleSort = (field) => {
    const order = sortField === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortField(field);
    setSortOrder(order);
  };

  const filteredHarvests = harvests
    .filter((harvest) =>
      harvest.name.toLowerCase().includes(filterName.toLowerCase())
    )
    .sort((a, b) => {
      if (sortField === 'profit') {
        return sortOrder === 'asc' ? a.profit - b.profit : b.profit - a.profit;
      } else if (sortField === 'timestamp') {
        return sortOrder === 'asc'
          ? a.timestamp - b.timestamp
          : b.timestamp - a.timestamp;
      }
      return 0;
    });

  const abbreviateHash = (hash) => {
    return `${hash.slice(0, 5)}...${hash.slice(-3)}`;
  };

  const formatProfit = (profit) => {
    return Number(profit).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (loading) {
    return <div className="loading-centered">Loading...</div>;
  }

  // Get unique names for the dropdown filter
  const uniqueNames = [...new Set(harvests.map((harvest) => harvest.name))].map(
    (name) => ({ value: name, label: name })
  );

  return (
    <div className="harvest-container">
      <table className="harvest-table">
        <thead>
          <tr>
            <th>
              <Select
                value={uniqueNames.find(
                  (option) => option.value === filterName
                )}
                onChange={handleFilterChange}
                options={uniqueNames}
                isClearable
                className="filter-select"
                placeholder="All"
                styles={{
                  control: (base) => ({
                    ...base,
                    border: 'none',
                    borderColor: 'transparent',
                    '&:hover': { borderColor: 'transparent' },
                    boxShadow: 'none',
                    backgroundColor: 'transparent',
                    minHeight: 'auto',
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused ? 'lightgray' : 'white',
                    color: 'black',
                    '&:hover': {
                      backgroundColor: 'lightgray',
                    },
                  }),
                  dropdownIndicator: (base) => ({
                    ...base,
                    padding: 0,
                    width: 0,
                    visibility: 'hidden',
                  }),
                  clearIndicator: (base) => ({
                    ...base,
                    padding: 0,
                  }),
                  indicatorsContainer: (base) => ({
                    ...base,
                    padding: 0,
                  }),
                }}
              />
            </th>
            <th>Txn Hash</th>
            <th onClick={() => handleSort('profit')} className="sortable">
              Profit{' '}
              {sortField === 'profit' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('timestamp')} className="sortable">
              Date{' '}
              {sortField === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredHarvests.map((harvest) => {
            const protocolIcon = getProtocolIcon(harvest.name);
            return (
              <tr key={harvest.id}>
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
                    <a
                      href={`https://etherscan.io/address/${harvest.compounder}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link"
                    >
                      {harvest.name}
                    </a>
                  </div>
                </td>
              <td>
                <a
                  href={`https://etherscan.io/tx/${harvest.txn_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                >
                  {abbreviateHash(harvest.txn_hash)}
                </a>
              </td>
              <td>{formatProfit(harvest.profit)}</td>
              <td>{new Date(harvest.timestamp * 1000).toLocaleDateString()}</td>
            </tr>
          );})}
        </tbody>
      </table>
      <div className="pagination">
        <span
          className="arrow"
          onClick={handlePreviousPage}
          disabled={page <= 1}
        >
          &lt;
        </span>
        <span className="page-number">
          {page}/{totalPages}
        </span>
        <span
          className="arrow"
          onClick={handleNextPage}
          disabled={page >= totalPages}
        >
          &gt;
        </span>
      </div>
    </div>
  );
};

export default HarvestTable;

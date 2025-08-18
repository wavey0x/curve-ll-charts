import React, { useState } from 'react';
import './FavoritesTable.css';

const FavoritesTable = ({ favorites, onGaugeClick, onRemoveFavorite }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copiedText, setCopiedText] = useState('');

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
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

  const formatAddress = (address) => {
    if (address && address.length > 10) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address || '';
  };

  if (favorites.length === 0) {
    return (
      <div className="favorites-section">
        <div className="favorites-header">
          <h3>
            <i className="fas fa-star"></i> Favorites
          </h3>
          <button
            className="collapse-button"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
          </button>
        </div>
        {!isCollapsed && (
          <div className="no-favorites">
            <p>
              No favorites yet. Search for a gauge and click the star to add it
              to your favorites!
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="favorites-section">
      <div className="favorites-header">
        <h3>
          <i className="fas fa-star"></i> Favorites ({favorites.length})
        </h3>
        <button
          className="collapse-button"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
        </button>
      </div>

      {!isCollapsed && (
        <div className="favorites-content">
          <div className="table-container">
            <table className="favorites-table">
              <thead>
                <tr>
                  <th>Gauge Name</th>
                  <th>Gauge</th>
                  <th>Pool</th>
                  <th>Curve</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {favorites.map((favorite) => (
                  <tr key={favorite.id} className="favorite-row">
                    <td className="gauge-name">
                      <button
                        className="gauge-link-button"
                        onClick={() => onGaugeClick(favorite.gauge_address)}
                        title="View gauge details"
                      >
                        {favorite.pool_name.split(' (')[0] ||
                          favorite.pool_name}
                      </button>
                    </td>
                    <td className="address-cell">
                      <div className="address-wrapper">
                        <span className="address-text">
                          {formatAddress(favorite.gauge_address)}
                        </span>
                        <button
                          className={`copy-button ${copiedText === favorite.gauge_address ? 'copied' : ''}`}
                          onClick={() =>
                            copyToClipboard(favorite.gauge_address)
                          }
                          title="Copy gauge address"
                        >
                          <i
                            className={`fas ${copiedText === favorite.gauge_address ? 'fa-check' : 'fa-copy'}`}
                          ></i>
                        </button>
                      </div>
                    </td>
                    <td className="address-cell">
                      <div className="address-wrapper">
                        <span className="address-text">
                          {formatAddress(favorite.pool_address)}
                        </span>
                        <button
                          className={`copy-button ${copiedText === favorite.pool_address ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(favorite.pool_address)}
                          title="Copy pool address"
                        >
                          <i
                            className={`fas ${copiedText === favorite.pool_address ? 'fa-check' : 'fa-copy'}`}
                          ></i>
                        </button>
                      </div>
                    </td>
                    <td className="link-cell">
                      {favorite.pool_url && (
                        <a
                          href={favorite.pool_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="curve-link"
                          title="View on Curve"
                        >
                          <i className="fas fa-external-link-alt"></i>
                        </a>
                      )}
                    </td>
                    <td className="delete-cell">
                      <button
                        className="delete-button"
                        onClick={() => onRemoveFavorite(favorite.gauge_address)}
                        title="Remove from favorites"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FavoritesTable;

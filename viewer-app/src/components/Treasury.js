import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Treasury.css';

const apiBaseUrl =
  process.env.REACT_APP_API_BASE_URL || 'https://api.wavey.info';
const normalizedApiBaseUrl = apiBaseUrl.replace(/\/$/, '');

const formatCurrency = (value, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(Number(value || 0));

const formatBalance = (value) => {
  const numericValue = Number(value || 0);
  const maximumFractionDigits = numericValue >= 1000 ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(numericValue);
};

const formatTimestamp = (timestamp) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(timestamp * 1000));

const shortenAddress = (address) =>
  address ? `${address.slice(0, 4)}...${address.slice(-3)}` : '';

const resolveApiAssetUrl = (path) => {
  if (!path) {
    return '';
  }

  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedApiBaseUrl}${normalizedPath}`;
};

const Treasury = () => {
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [failedLogos, setFailedLogos] = useState({});
  const [visibleBalances, setVisibleBalances] = useState({});

  useEffect(() => {
    const fetchBalanceSheet = async () => {
      try {
        const response = await axios.get(
          `${normalizedApiBaseUrl}/api/crvlol/treasury_balance_sheet`
        );
        setBalanceSheet(response.data);
      } catch (err) {
        setError('Failed to fetch treasury balance sheet.');
        console.error('Error fetching treasury balance sheet:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBalanceSheet();
  }, []);

  if (loading) {
    return (
      <div className="loading-centered">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error || !balanceSheet) {
    return (
      <div className="treasury-error">{error || 'No data available.'}</div>
    );
  }

  return (
    <div className="treasury-container">
      <div className="treasury-header">
          <div className="treasury-total">
          <div className="treasury-kicker">Total</div>
          <div className="treasury-total-value">
            {formatCurrency(balanceSheet.grand_total_usd)}
          </div>
        </div>
        <div className="treasury-meta">
          <span>{formatTimestamp(balanceSheet.captured_at)} UTC</span>
        </div>
      </div>

      <div className="treasury-wallets">
        {balanceSheet.wallets.map((wallet) => (
          <section key={wallet.address} className="treasury-wallet">
            <div className="treasury-wallet-header">
              <div className="treasury-wallet-title">
                <span className="treasury-wallet-name">{wallet.name}</span>
                <a
                  href={`https://etherscan.io/address/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="treasury-wallet-address"
                >
                  ({shortenAddress(wallet.address)})
                </a>
              </div>
              <div className="treasury-wallet-total">
                {formatCurrency(wallet.total_usd)}
              </div>
            </div>

            <div className="treasury-wallet-rows">
              {wallet.rows.length === 0 && (
                <div className="treasury-empty-row">No tracked balances</div>
              )}

              {wallet.rows.map((row) => (
                <button
                  type="button"
                  key={`${wallet.address}-${row.label}`}
                  className={`treasury-asset-row ${
                    row.kind === 'vest_return' ? 'treasury-asset-row-note' : ''
                  }`}
                  onClick={() =>
                    setVisibleBalances((current) => ({
                      ...current,
                      [`${wallet.address}-${row.label}`]:
                        !current[`${wallet.address}-${row.label}`],
                    }))
                  }
                >
                  <div className="treasury-asset-main">
                    <div className="treasury-token-logo-shell">
                      {row.logo_path &&
                      !failedLogos[`${wallet.address}-${row.label}`] ? (
                        <img
                          src={resolveApiAssetUrl(row.logo_path)}
                          alt=""
                          className="treasury-token-logo"
                          loading="lazy"
                          onError={() =>
                            setFailedLogos((current) => ({
                              ...current,
                              [`${wallet.address}-${row.label}`]: true,
                            }))
                          }
                        />
                      ) : (
                        <span className="treasury-token-fallback">
                          {row.symbol?.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="treasury-asset-label">
                      <span>{row.label}</span>
                      {row.kind === 'vest_return' && (
                        <span className="treasury-asset-note">
                          return at vest end
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="treasury-asset-values">
                    <span className="treasury-asset-value">
                      {visibleBalances[`${wallet.address}-${row.label}`]
                        ? `${formatBalance(row.balance)} ${row.symbol}`
                        : formatCurrency(row.usd_value)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {balanceSheet.footnotes?.length > 0 && (
        <div className="treasury-footnotes">
          {balanceSheet.footnotes.map((footnote) => (
            <div key={footnote.label} className="treasury-footnote">
              <span className="treasury-footnote-marker">{footnote.label}</span>
              <span>{footnote.text}</span>
              {footnote.address && (
                <a
                  href={`https://etherscan.io/address/${footnote.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="treasury-footnote-link"
                >
                  {shortenAddress(footnote.address)}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Treasury;

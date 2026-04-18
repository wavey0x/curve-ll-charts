# Treasury Balance Sheet Update

## Delivered

- Added USDC to the tracked treasury token set so each wallet now checks CRV, crvUSD, scrvUSD, and USDC balances.
- Switched treasury token metadata to use the Wavey price API response, including `token.logo_url`.
- Cached token logos in the local project under `cache/token-logos/<chain_id>/` and exposed them through Flask at `/api/crvlol/token-logos/<chain_id>/<filename>`.
- Added `/api/crvlol/treasury_balance_sheet` so the frontend can read the cached treasury payload directly from `data/ll_info.json`.
- Reworked the treasury UI into a minimal wallet list: wallet header, subtotal, token logo, token label, USD value, and token balance.

## Files

- `scripts/treasury_balance_sheet.py`
- `app.py`
- `viewer-app/src/components/Treasury.js`
- `viewer-app/src/components/Treasury.css`
- `.gitignore`

## Verification

- `python3 -m compileall app.py scripts/treasury_balance_sheet.py`
- `npm run build` in `viewer-app`
- Flask test client confirmed:
  - `/api/crvlol/treasury_balance_sheet` returns `200` against a sample cache file
  - `/api/crvlol/token-logos/1/0xd533a949740bb3306d119cc777fa900ba034cd52.png` returns `200`

## Notes

- Local anonymous requests to `https://prices.wavey.info/v1/price` hit `RATE_LIMITED` after the first token during verification. The code still supports `TOKEN_PRICE_AGG_KEY` and the existing fallback env vars (`TIDAL_DEPLOY_PRICE_API_KEY`, `FACTORY_DASHBOARD_DEPLOY_PRICE_API_KEY`) for the full multi-token refresh path.

# CRV.LOL

CRV.LOL contains the web application served at `crv.lol` and the scheduled
Brownie job that publishes its on-chain data snapshot. The public HTTP API is
owned by the separate `wavey-api` repository.

## Layout

- `web/` — React frontend deployed by Vercel.
- `crv_lol/` — liquid-locker, gauge, treasury, and snapshot modules.
- `scripts/refresh.py` — Brownie entry point for the scheduled refresh.
- `tests/` — data-generation and atomic-publication tests.

## Refresh data

```bash
export CRVLOL_SNAPSHOT_PATH=/var/lib/crv-lol/snapshot.json
brownie run refresh --network electro
```

The refresh is assembled in memory and atomically replaces the snapshot only
after validation. A failed refresh leaves the last-known-good snapshot intact.

## Web application

```bash
cd web
npm install
npm start
```

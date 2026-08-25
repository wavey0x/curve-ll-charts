# CRV.LOL web

The React frontend for `crv.lol`.

```bash
npm install
npm start
```

Production API requests default to `https://api.wavey.info`. To use a local
API, create `.env.local` with:

```dotenv
REACT_APP_API_BASE_URL=http://localhost:8000
```

Run the checks with:

```bash
npm test -- --watchAll=false
npm run build
npm run format-check
```

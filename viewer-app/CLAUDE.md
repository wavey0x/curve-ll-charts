# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start development server (localhost:3000)
npm start

# Build for production
npm run build

# Run tests in watch mode
npm test

# Format code with Prettier
npm run format

# Check if code is properly formatted
npm run format-check
```

## Architecture

This is a React application built with Create React App that displays Curve Finance liquid locker and gauge data. The app fetches data from a custom API backend and presents it through interactive charts and tables.

### Core Pages and Routing
- **LL Data** (`/`) - Main dashboard with APR charts and combined protocol data table
- **Gauges** (`/gauges`) - Gauge search functionality with favorites management
- **DAO** (`/dao`) - Active governance proposals display

**URL Parameter Handling**: URLs with `gauge=0x...` parameter automatically redirect to `/gauges` tab with the parameter preserved.

### Key Components Structure
- `App.js` - Main routing and layout with `GaugeParamHandler` for URL parameter redirection
- `Data.js` - Combined table showing APR data across protocols with collapsible harvest history
- `GaugeSearch.js` - Main gauge search with favorites table integration
- `APRChart.js` - Recharts-based line charts with protocol logos positioned at line endpoints
- `FavoritesTable.js` - Persistent favorites stored in localStorage
- `Dao.js` - Governance proposals with gauge validation status

### API Integration
The app uses multiple API endpoint patterns:
- Production: `https://api.wavey.info/api/crvlol/`
- Development fallback: `http://192.168.1.87:8000` (configured via `REACT_APP_API_BASE_URL`)
- Proxy configuration in package.json points to `localhost:8000`

All API calls implement retry logic with exponential backoff for reliability.

### State Management
- **Favorites**: Managed by `useFavorites` hook with localStorage persistence under `curve_gauge_favorites` key
- **API Data**: Component-level state with axios instances configured per component
- **Responsive UI**: Window width-based conditional rendering throughout components

## Styling Conventions

### Font Usage
All components use monospace fonts: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`

### Color Scheme
- Primary text: `#000000`
- Hover states: `#666666` (replaces any purple accents)
- Active nav tabs: white background
- Inactive nav tabs: `#f0f0f0` background
- Table borders: `#e0e0e0`
- Green highlighting: `#f0fdf4` for best/winning values

### Layout Patterns
- Data tables use `box-shadow: 0 0 0 1px #e0e0e0` instead of solid borders
- White table headers (`#ffffff`) for seamless appearance
- Chart containers max-width 700px, centered with `margin: 0 auto`

## Mobile Responsiveness

### Critical Breakpoints
- `≤480px`: Extra small screens with minimal spacing
- `≤768px`: Mobile screens with column hiding
- `≤1024px`: Tablet screens

### Column Visibility Patterns
On mobile (≤768px), tables prioritize APR columns and hide less important data:
- **Show**: Protocol, 30D APR, 60D APR, 90D APR, TVL
- **Hide**: Fee, PUP (Profit Unlock Period)

This pattern is implemented in Data.css with nth-child selectors for responsive design.

### Chart Responsiveness
- Icons positioned at line endpoints with screen-size aware boundary checking
- Right margins adjusted: 40px mobile, 50px desktop
- Protocol logos have 1px shadow: `box-shadow: 0 0 0 1px rgba(0,0,0,0.2)`

## Development Notes

### Data Processing
- APR values multiplied by 100 for percentage display
- TVL formatted as millions with 'M' suffix (e.g., "$1.23M")
- Protocol icons mapped by symbol matching in both chart and table components

### Favorites System
Favorites are complex objects containing:
```javascript
{
  id: gauge_address,
  gauge_address: string,
  pool_address: string,
  pool_name: string,
  pool_url: string,
  blockchain: string,
  added_at: ISO timestamp
}
```

### Chart Icon Positioning
Icons are positioned using `calculateIconPosition` function that:
1. Places icons at actual line endpoints (cx, cy coordinates)
2. Applies minimal vertical stacking for close values (within 0.3%)
3. Uses screen-size aware boundary checking to prevent overflow

## CSS Architecture

Global styles in `App.css` can override component styles. When making component-specific changes, ensure they don't conflict with global selectors like `.data-table` or `.nav-link`.

Each component has its own CSS file following the pattern: `ComponentName.css` with styles scoped to the component's main class.
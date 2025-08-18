import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import HarvestTable from './components/HarvestTable';
import Data from './components/Data';
import About from './components/About';
import GaugeSearch from './components/GaugeSearch';
import Dao from './components/Dao';
import APRChart from './components/APRChart';
import { useFavorites } from './hooks/useFavorites';

// Debug: Log the environment variables
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);

const axiosInstance = axios.create({
  baseURL: 'https://api.wavey.info/',
});

// Navigation component
const Navigation = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'LL Data' },
    { path: '/dao', label: 'DAO' },
    { path: '/gauges', label: 'Gauges' },
  ];

  return (
    <nav className="navigation">
      <ul className="nav-list">
        {navItems.map((item) => (
          <li key={item.path} className="nav-item">
            <Link 
              to={item.path} 
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

// Charts component
const Charts = () => {
  const [weeklyData, setWeeklyData] = useState([]);
  const [sinceData, setSinceData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchChartData = async () => {
    try {
      const url = `api/crvlol/info`;
      const response = await axiosInstance.get(url);

      console.log('Chart data:', response.data.chart_data);

      const chartData = response.data.chart_data;
      
      if (!chartData) {
        console.log('No chart_data found in response');
        return;
      }
      
      // Process weekly_aprs data
      if (chartData.weekly_aprs && Array.isArray(chartData.weekly_aprs)) {
        const weeklyChartData = chartData.weekly_aprs
          .map((item) => ({
            date: new Date(item.date).getTime(),
            asdCRV: item.asdCRV * 100,
            yvyCRV: item.yvyCRV * 100,
            ucvxCRV: item.ucvxCRV * 100,
          }))
          .sort((a, b) => a.date - b.date);
        setWeeklyData(weeklyChartData);
      }

      // Process apr_since data
      if (chartData.apr_since && Array.isArray(chartData.apr_since)) {
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
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await fetchChartData();
      setLoading(false);
    };
    fetchAllData();
  }, []);

  return (
    <div className="chart-section">
      {loading ? (
        <div className="loading-centered">
          Loading charts...
        </div>
      ) : (
        <div className="charts-container">
          <APRChart data={sinceData} title="APR Since" height={400} />
          <APRChart data={weeklyData} title="Weekly APRs" height={400} />
        </div>
      )}
    </div>
  );
};

// Harvests component
const Harvests = () => (
  <div className="harvest-data-section extra-class">
    <div>
      <h1 style={{ textAlign: 'center' }}>Harvest History</h1>
      <HarvestTable />
    </div>
  </div>
);

// Gauges component with favorites
const Gauges = () => {
  const { favorites, toggleFavorite, isFavorite, removeFavorite } = useFavorites();
  
  return (
    <div className="gauge-section">
      <GaugeSearch
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        isFavorite={isFavorite}
        removeFavorite={removeFavorite}
      />
    </div>
  );
};

// Main layout component
const Layout = ({ children }) => (
  <div className="App">
    <header>
      <h1 className="main-header">CRV.LOL</h1>
    </header>
    <Navigation />
    <main>{children}</main>
    <Footer />
  </div>
);

// Footer component
const Footer = () => (
  <footer>
    <a
      href="https://github.com/wavey0x/curve-ll-charts/"
      target="_blank"
      rel="noopener noreferrer"
    >
      <i className="fab fa-github"></i> Source
    </a>
    <a
      href="https://twitter.com/wavey0x"
      target="_blank"
      rel="noopener noreferrer"
    >
      <i className="fab fa-twitter"></i> Contact
    </a>
  </footer>
);

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<div className="data data-section"><Data /></div>} />
          <Route path="/dao" element={<div className="data data-section"><Dao /></div>} />
          <Route path="/gauges" element={<Gauges />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

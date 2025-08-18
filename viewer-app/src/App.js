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

// Force localhost in development, regardless of environment variables
const getBaseURL = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.REACT_APP_API_BASE_URL || '';
  }
  // In development, always use localhost:8000
  return 'http://localhost:8000/';
};

const axiosInstance = axios.create({
  baseURL: getBaseURL(),
});

// Navigation component
const Navigation = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Charts' },
    { path: '/data', label: 'Data' },
    { path: '/harvests', label: 'Harvests' },
    { path: '/about', label: 'About' },
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

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get('api/crvlol/info');
        
        // Extract chart data from the response
        const { weekly_data, since_data } = response.data;
        
        // Process weekly data
        if (weekly_data) {
          const weeklyChartData = weekly_data
            .map((item) => ({
              date: new Date(item.date).getTime(),
              asdCRV: item.asdCRV,
              yvyCRV: item.yvyCRV,
              ucvxCRV: item.ucvxCRV,
            }))
            .sort((a, b) => a.date - b.date);
          setWeeklyData(weeklyChartData);
        }
        
        // Process since data
        if (since_data) {
          const sinceChartData = since_data
            .map((item) => ({
              date: new Date(item.date).getTime(),
              asdCRV: item.asdCRV,
              yvyCRV: item.yvyCRV,
              ucvxCRV: item.ucvxCRV,
            }))
            .sort((a, b) => a.date - b.date);
          setSinceData(sinceChartData);
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchChartData();
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
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
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
      <h1 className="main-header">APR Transparency</h1>
      <h3 className="sub-header">CRV Liquid Locker Auto-compounders</h3>
    </header>
    <hr />
    <div className="intro"></div>
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
          <Route path="/" element={<Charts />} />
          <Route path="/data" element={<div className="data data-section"><Data /></div>} />
          <Route path="/harvests" element={<Harvests />} />
          <Route path="/about" element={<About />} />
          <Route path="/gauges" element={<Gauges />} />
          <Route path="/dao" element={<Dao />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

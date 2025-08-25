import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useLocation, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import HarvestTable from './components/HarvestTable';
import Data from './components/Data';
import GaugeSearch from './components/GaugeSearch';
import Dao from './components/Dao';
import { useFavorites } from './hooks/useFavorites';

// Debug: Log the environment variables
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);

const axiosInstance = axios.create({
  baseURL: 'https://api.wavey.info/',
});

// Component to handle gauge parameter routing
const GaugeParamHandler = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const gaugeParam = searchParams.get('gauge');
  
  // If gauge parameter exists, redirect to /gauges with the parameter
  if (gaugeParam && location.pathname === '/') {
    return <Navigate to={`/gauges?gauge=${gaugeParam}`} replace />;
  }
  
  // Otherwise render the Data component
  return <div className="data data-section"><Data /></div>;
};

// Navigation component
const Navigation = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'LL Data' },
    { path: '/gauges', label: 'Gauges' },
    { path: '/dao', label: 'DAO' },
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
const Footer = () => {
  const [lastUpdated, setLastUpdated] = useState(null);
  const [timeAgo, setTimeAgo] = useState('');
  const [isStale, setIsStale] = useState(false);

  // Function to calculate relative time
  const getTimeAgo = (timestamp) => {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const diffInSeconds = now - timestamp;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return 'just now';
    } else if (diffInMinutes === 1) {
      return '1 minute ago';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInHours === 1) {
      return '1 hour ago';
    } else if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else if (diffInDays === 1) {
      return '1 day ago';
    } else {
      return `${diffInDays} days ago`;
    }
  };

  // Fetch last updated time
  useEffect(() => {
    const fetchLastUpdated = async () => {
      try {
        const response = await axiosInstance.get('api/crvlol/info');
        const timestamp = response.data.last_updated;
        if (timestamp) {
          setLastUpdated(timestamp);
          const timeAgoText = getTimeAgo(timestamp);
          setTimeAgo(timeAgoText);
          
          // Check if data is stale (60+ minutes old)
          const now = Math.floor(Date.now() / 1000);
          const diffInMinutes = Math.floor((now - timestamp) / 60);
          setIsStale(diffInMinutes >= 60);
        }
      } catch (error) {
        console.error('Error fetching last updated time:', error);
      }
    };

    fetchLastUpdated();
    
    // Update time display every minute
    const interval = setInterval(() => {
      if (lastUpdated) {
        const timeAgoText = getTimeAgo(lastUpdated);
        setTimeAgo(timeAgoText);
        
        // Update stale status
        const now = Math.floor(Date.now() / 1000);
        const diffInMinutes = Math.floor((now - lastUpdated) / 60);
        setIsStale(diffInMinutes >= 60);
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <footer className={isStale ? 'footer-stale' : ''}>
      <div className="footer-content">
        {timeAgo && (
          <div className="footer-updated">
            <span className="last-updated">
              Updated: {timeAgo}
            </span>
          </div>
        )}
        <div className="footer-separator"></div>
        <div className="footer-icons">
          <a
            href="https://github.com/wavey0x/curve-ll-charts/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-icon"
          >
            <i className="fab fa-github"></i>
          </a>
          <a
            href="https://twitter.com/wavey0x"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-icon"
          >
            <i className="fab fa-twitter"></i>
          </a>
        </div>
      </div>
    </footer>
  );
};

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<GaugeParamHandler />} />
          <Route path="/dao" element={<div className="data data-section"><Dao /></div>} />
          <Route path="/gauges" element={<Gauges />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

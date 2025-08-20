import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useLocation, Navigate } from 'react-router-dom';
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
          <Route path="/" element={<GaugeParamHandler />} />
          <Route path="/dao" element={<div className="data data-section"><Dao /></div>} />
          <Route path="/gauges" element={<Gauges />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

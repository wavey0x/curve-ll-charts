import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import axios from 'axios';
import vegaEmbed from 'vega-embed';
import Switch from 'react-switch';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import './App.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import HarvestTable from './components/HarvestTable';
import Data from './components/Data';
import Markdown from 'react-markdown';
import About from './components/About';
import GaugeVotes from './components/GaugeVotes';

const axiosInstance = axios.create({
  baseURL:
    process.env.NODE_ENV === 'production'
      ? `${process.env.REACT_APP_API_BASE_URL}/crvlol`
      : process.env.REACT_APP_API_BASE_URL,
});

function MainContent() {
  const [peg, setPeg] = useState(false);
  const [chartSpec, setChartSpec] = useState();
  const [chartSpecSince, setChartSpecSince] = useState();
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [forceRender, setForceRender] = useState(0); // State to force re-render
  const vegaRef = useRef(null);
  const vegaRefSince = useRef(null);

  const updateSpecForMobile = (spec) => {
    spec.config = spec.config || {};
    if (window.innerWidth <= 768) {
      spec.config.legend = {
        ...spec.config.legend,
        orient: 'bottom', // Move legend to the bottom on mobile
      };
    } else {
      spec.config.legend = {
        ...spec.config.legend,
        orient: 'right', // Default legend position
      };
    }
    // Remove the legend title
    spec.config.legend = {
      ...spec.config.legend,
      title: null,
    };
    return spec;
  };

  const fetchChart = async (chartType) => {
    try {
      const response = await axiosInstance.get(`charts/${chartType}/${peg}`);
      let spec = response.data;
      let baseTitle = chartType.replace(/_/g, ' ');
      baseTitle = baseTitle
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      spec.title = baseTitle + (peg ? ' (Adjusted For Peg)' : '');
      spec.autosize = { type: 'fit', contains: 'padding' };

      spec = updateSpecForMobile(spec);

      if (chartType === 'Weekly_APRs') {
        setChartSpec(spec);
      } else {
        setChartSpecSince(spec);
      }
    } catch (error) {
      console.error('Error fetching chart:', error);
    }
  };

  useEffect(() => {
    fetchChart('Weekly_APRs');
    fetchChart('APR_Since');
  }, [peg]);

  useEffect(() => {
    if (vegaRef.current && chartSpec) {
      vegaEmbed(vegaRef.current, chartSpec, { actions: false })
        .then((result) => {
          // Access the Vega view instance as result.view
        })
        .catch((error) => console.error(error));
    }
  }, [chartSpec, forceRender]); // Added forceRender to dependencies

  useEffect(() => {
    if (vegaRefSince.current && chartSpecSince) {
      vegaEmbed(vegaRefSince.current, chartSpecSince, { actions: false })
        .then((result) => {
          // Access the Vega view instance as result.view
        })
        .catch((error) => console.error(error));
    }
  }, [chartSpecSince, forceRender]); // Added forceRender to dependencies

  const handleTabSelect = (index) => {
    setActiveTabIndex(index);
    if (index === 0) {
      setForceRender(forceRender + 1); // Change state to force re-render
    }
  };

  return (
    <div className="App">
      <header>
        <h1 className="main-header">APR Transparency</h1>
        <h3 className="sub-header">CRV Liquid Locker Auto-compounders</h3>
      </header>
      <hr />
      <div className="intro"></div>

      <Tabs selectedIndex={activeTabIndex} onSelect={handleTabSelect}>
        <TabList>
          <Tab>Charts</Tab>
          <Tab>Data</Tab>
          <Tab>Harvests</Tab>
          <Tab>About</Tab>
        </TabList>

        <TabPanel>
          <div className="switch-container">
            <label>
              Denominate in CRV:
              <div className="switch-wrapper">
                <Switch
                  onChange={() => setPeg(!peg)}
                  checked={peg}
                  offColor="#ccc" // Light gray for the off state
                  onColor="#ccc" // White for the on state
                  uncheckedIcon={false}
                  checkedIcon={false}
                  className="react-switch"
                />
              </div>
            </label>
          </div>
          <div className="chart-section">
            <div className="chart-container" ref={vegaRefSince} />
            <div className="chart-container" ref={vegaRef} />
          </div>
        </TabPanel>
        <TabPanel>
          <div className="data data-section">
            <Data></Data>
          </div>
        </TabPanel>
        <TabPanel>
          <div className="harvest-data-section extra-class">
            <div>
              <h1>Harvest History</h1>
              <HarvestTable />
            </div>
            {/* <ReactMarkdown>
              {`TODO: Sortable table with harvest transactions for each auto-compounder.`}
            </ReactMarkdown> */}
          </div>
        </TabPanel>
        <TabPanel>
          <About />
        </TabPanel>
      </Tabs>

      <footer>
        <a
          href="https://github.com/wavey0x/curve-ll-charts/blob/master/scripts/apr_charts.py"
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
        {/* <Link to="/gauge_votes">Gauge Votes</Link> */}
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainContent />} />
        <Route path="/gauge_votes" element={<GaugeVotes />} />
      </Routes>
    </Router>
  );
}

export default App;

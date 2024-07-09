import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import vegaEmbed from 'vega-embed';
import Switch from 'react-switch';
import ReactMarkdown from 'react-markdown';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import './App.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL, // Specify the Flask server URL and port
});

function App() {
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
      const response = await axiosInstance.get(`/charts/${chartType}/${peg}`);
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
      <header>APR Charts for CRV Liquid Locker Auto-compounders</header>
      <hr />
      <div className="intro">
      <ReactMarkdown>
        {`Auto-compounders serve as a useful means for APR comparisons between liquid locker products. Each locker product has one, and while they all differ in some respects, they are great for abstracting complex reward mechanics and simplifying yield calculations.  
          
All data on this page is gathered exclusively from on-chain. The code is fully open source. You may view or contribute via [my Github](https://github.com/wavey0x/curve-ll-charts).   

`}
      </ReactMarkdown>
      </div>

      <Tabs selectedIndex={activeTabIndex} onSelect={handleTabSelect}>
        <TabList>
          <Tab>Charts</Tab>
          <Tab>Information</Tab>
          <Tab>Harvest Data</Tab>
        </TabList>

        <TabPanel>
        <div className="switch-container">
        <label>
          Denominate in CRV:
          <div className="switch-wrapper">
          <Switch
            onChange={() => setPeg(!peg)}
            checked={peg}
            offColor="#ccc"  // Light gray for the off state
            onColor="#ccc"   // White for the on state
            uncheckedIcon={false}
            checkedIcon={false}
            className="react-switch"
          />
          </div>
        </label>
      </div>
          <div className="chart-section">
            <div className="chart-container" ref={vegaRef} />
            <div className="chart-container" ref={vegaRefSince} />
          </div>
        </TabPanel>
        <TabPanel>
          <div className="info information-section">
            <ReactMarkdown>
              {`TODO: Populate with information about calculation methodology. Perf fees, profit unlocking duration, other config for each auto-compounder. Add contract addresses. Etc.`}
            </ReactMarkdown>
          </div>
        </TabPanel>
        <TabPanel>
          <div className="info harvest-data-section extra-class">
            <ReactMarkdown>
              {`TODO: Sortable table with harvest transactions for each auto-compounder.`}
            </ReactMarkdown>
          </div>
        </TabPanel>
      </Tabs>

      <footer>
        <a href="https://github.com/wavey0x/curve-ll-charts/blob/master/scripts/apr_charts.py" target="_blank" rel="noopener noreferrer">
          <i className="fab fa-github"></i> Chart Source
        </a>
        <a href="https://twitter.com/wavey0x" target="_blank" rel="noopener noreferrer">
          <i className="fab fa-twitter"></i> Contact
        </a>
      </footer>
    </div>
  );
}

export default App;

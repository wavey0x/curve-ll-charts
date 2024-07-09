import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import vegaEmbed from 'vega-embed';
import Switch from 'react-switch';
import ReactMarkdown from 'react-markdown';
import './App.css';

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL, // Specify the Flask server URL and port
});

function App() {
  const [peg, setPeg] = useState(false);
  const [chartSpec, setChartSpec] = useState();
  const [chartSpecSince, setChartSpecSince] = useState();
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
  }, [chartSpec]);

  useEffect(() => {
    if (vegaRefSince.current && chartSpecSince) {
      vegaEmbed(vegaRefSince.current, chartSpecSince, { actions: false })
        .then((result) => {
          // Access the Vega view instance as result.view
        })
        .catch((error) => console.error(error));
    }
  }, [chartSpecSince]);

  return (
    <div className="App">
      <header>APR Charts for CRV Liquid Locker Auto-compounders</header>
      <hr />
      <ReactMarkdown>
        {`All data on this page is gathered from directly on-chain sources.  
It will always remain fully open source. You may view the code or contribute any time at [my Github](https://github.com/wavey0x/curve-ll-charts).   
Auto-compounders serve as a useful comparisons between the variety of lockers and their unique mechanics
`}
      </ReactMarkdown>
      <div className="switch-container">
        <label>
          Adjust charts for peg:
          <div className="switch-wrapper">
            <Switch
              onChange={() => setPeg(!peg)}
              checked={peg}
              offColor="#888"
              onColor="#0d6efd"
              uncheckedIcon={false}
              checkedIcon={false}
              className="react-switch"
            />
          </div>
        </label>
      </div>
      <div className="chart-section">
        <div className="chart-container" ref={vegaRef} />
      </div>
      <div className="chart-section">
        <div className="chart-container" ref={vegaRefSince} />
      </div>
    </div>
  );
}

export default App;

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import vegaEmbed from 'vega-embed';
import Switch from 'react-switch';
import './App.css';

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL // Specify the Flask server URL and port
});

function App() {
  const [peg, setPeg] = useState(false);
  const [chartName, setChartName] = useState('Weekly_APRs');
  const [chartSpec, setChartSpec] = useState();
  const [chartSpecSince, setChartSpecSince] = useState();
  const vegaRef = useRef(null);
  const vegaRefSince = useRef(null);

  const updateSpecForMobile = (spec) => {
    spec.config = spec.config || {};
    if (window.innerWidth <= 768) {
      spec.config.legend = {
        ...spec.config.legend,
        orient: 'bottom' // Move legend to the bottom on mobile
      };
    } else {
      spec.config.legend = {
        ...spec.config.legend,
        orient: 'right' // Default legend position
      };
    }
    // Remove the legend title
    spec.config.legend = {
      ...spec.config.legend,
      title: null
    };
    return spec;
  };

  const fetchChart = async (chartType) => {
    try {
      // console.log()
      // let url = `http://127.0.0.1:5000/charts/${chartType}/${peg}`;
      
      const response = await axiosInstance.get(`/charts/${chartType}/${peg}`);
      let spec = response.data;
      // Ensure autosize is set for the chart spec
      let baseTitle = chartType.replace(/_/g, ' ');
      // Capitalize the first letter of each word
      baseTitle = baseTitle.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

      // Set the chart title based on the peg value
      spec.title = baseTitle + (peg ? ' (Adjusted For Peg)' : '');
      spec.autosize = { type: 'fit', contains: 'padding' };
      // Update spec for mobile
      spec = updateSpecForMobile(spec);
      
      if (chartType === 'Weekly_APRs') {
        setChartSpec(spec);
      } else {
        setChartSpecSince(spec);
      }
    } catch (error) {
      console.error("Error fetching chart:", error);
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
      <h1>Liquid Locker Auto-compounders</h1>
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
            <div className="tooltip">
              This setting adjusts the chart data based on the peg value.
            </div>
          </div>
        </label>
      </div>
      <div className="chart-section">
        {/* <h2>Weekly APRs</h2> */}
        <div className="chart-container" ref={vegaRef} />
      </div>
      <div className="chart-section">
        {/* <h2>APR Since</h2> */}
        <div className="chart-container" ref={vegaRefSince} />
      </div>
    </div>
  );
}

export default App;
import React from 'react';
import ReactMarkdown from 'react-markdown';
import AddressList from './AddressList';

const About = () => {
  return (
    <div className="about about-section about-content">
      <ReactMarkdown>
        {`## About  

All code used to produce this app is fully open source. All data comes directly from the chain. You may view or contribute on [Github](https://github.com/wavey0x/curve-ll-charts).

## Charts
- The "APR Since" chart on the charts tab measures APR from any given point on the chart until today's date.
- The "Weekly APRs" chart measures the APR between any point and the point immediately prior to it.

## Contracts

`}
      </ReactMarkdown>
      <AddressList />
    </div>
  );
};

export default About;

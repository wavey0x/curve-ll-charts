import React from 'react';
import ReactMarkdown from 'react-markdown';
import AddressList from './AddressList';

const About = () => {
  return (
    <div className="about about-section">
      <ReactMarkdown>
        {`## About  

All code used to produce this app is fully open source. All data comes directly from the chain. You may view or contribute on [Github](https://github.com/wavey0x/curve-ll-charts).

## Charts
- The "APR Since" chart on the charts tab measures APR from any given point on the chart until today's date.
- The "Weekly APRs" chart measures the APR between any point and the point immediately prior to it.
- Enable or disable the "Denominate in CRV" switch at the top to adjust the charts based on the liquid locker's performance to peg. E.g. a portion of Yearn's high APR can be attributed to it being below peg in early 2024. This toggle normalizes for that.

## Contracts

`}
      </ReactMarkdown>
      <AddressList />
    </div>
  );
};

export default About;

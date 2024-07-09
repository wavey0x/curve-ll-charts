import React from 'react';
import ReactMarkdown from 'react-markdown';
import AddressList from './AddressList';

const About = () => {
  return (
    <div className="about about-section">
      <ReactMarkdown>
        {`## About  

Transparency in DeFi is important. In fact, it is the essence of DeFi itself. The goal of this site is to help increase transparency of liquid locker data in the Curve ecosystem. 

Don't trust numbers from black-box websites, verify!

All data on this page is gathered exclusively from on-chain calls and **zero** external data sources.  

To start, I've selected auto-compounders to use as for APR comparisons between liquid locker products. They are useful because each liquid locker project has one, and while they all differ in some respects, they are great for abstracting complex reward mechanics and simplifying yield calculations.  
          

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

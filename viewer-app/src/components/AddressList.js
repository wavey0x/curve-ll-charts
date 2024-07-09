import React from 'react';
import './AddressList.css';

const CURVE_LIQUID_LOCKER_COMPOUNDERS = {
    '0xde2bEF0A01845257b4aEf2A2EAa48f6EAeAfa8B7': {
        'name': 'Union Convex CRV',
        'symbol': 'ucvxCRV',
        'underlying': '0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7',
        'pool': '0x971add32Ea87f10bD192671630be3BE8A11b8623',
        'color': 'orange'
    },
    '0x27B5739e22ad9033bcBf192059122d163b60349D': {
        'name': 'Staked Yearn CRV',
        'symbol': 'yvyCRV',
        'underlying': '0xFCc5c47bE19d06BF83eB04298b026F81069ff65b',
        'pool': '0x99f5aCc8EC2Da2BC0771c32814EFF52b712de1E5',
        'color': 'blue'
    },
    '0x43E54C2E7b3e294De3A155785F52AB49d87B9922': {
        'name': 'Aladin StakeDao CRV',
        'symbol': 'asdCRV',
        'underlying': '0xD1b5651E55D4CeeD36251c61c50C889B36F6abB5',
        'pool': '0xCA0253A98D16e9C1e3614caFDA19318EE69772D0',
        'color': 'black'
    },
};

const AddressList = () => {
    const copyToClipboard = (address) => {
        navigator.clipboard.writeText(address).then(() => {
            console.log(`Copied ${address} to clipboard`);
        });
    };

    return (
        <div className="address-list">
            {Object.keys(CURVE_LIQUID_LOCKER_COMPOUNDERS).map((address) => (
                <div className="address-item" key={address}>
                    <span className="symbol">{CURVE_LIQUID_LOCKER_COMPOUNDERS[address].symbol}</span>
                    <a 
                        href={`https://etherscan.io/address/${address}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="address-link"
                    >
                        {address}
                    </a>
                    <button 
                        className="copy-button" 
                        onClick={() => copyToClipboard(address)}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
};

export default AddressList;

import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import './Dao.css';

const Dao = () => {
  const location = useLocation();
  const isBalanceSheetView = location.pathname.endsWith('/balance-sheet');

  return (
    <div className="dao-container">
      <div className="dao-header">
        <h2>DAO</h2>
        <p className="dao-header-copy">
          Governance activity and treasury state for Curve-facing DAO workflows.
        </p>
      </div>

      <div className="dao-view-switcher" role="tablist" aria-label="DAO views">
        <NavLink
          to="/dao/proposals"
          className={({ isActive }) =>
            `dao-view-link ${isActive ? 'active' : ''}`
          }
        >
          Proposals
        </NavLink>
        <NavLink
          to="/dao/balance-sheet"
          className={({ isActive }) =>
            `dao-view-link ${isActive ? 'active' : ''}`
          }
        >
          Balance Sheet
        </NavLink>
      </div>

      <div className="dao-view-copy">
        {isBalanceSheetView
          ? 'Current DAO-controlled wallet balances.'
          : 'Active Curve governance proposals and gauge validations.'}
      </div>

      <Outlet />
    </div>
  );
};

export default Dao;

import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import './Dao.css';

const Dao = () => {
  return (
    <div className="dao-container">
      <div className="dao-view-switcher" aria-label="DAO views">
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

      <Outlet />
    </div>
  );
};

export default Dao;

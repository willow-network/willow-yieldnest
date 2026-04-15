import { NavLink, Outlet } from "react-router-dom";
import "./theme.css";

export function Layout() {
  return (
    <>
      <header className="yn-header">
        <div className="yn-logo">Yield<span>Nest</span></div>
        <nav className="yn-nav">
          <NavLink to="/overview"    className={({ isActive }) => isActive ? "active" : ""}>Overview</NavLink>
          <NavLink to="/earn"        className={({ isActive }) => isActive ? "active" : ""}>Earn</NavLink>
          <NavLink to="/portfolio"   className={({ isActive }) => isActive ? "active" : ""}>Portfolio</NavLink>
          <NavLink to="/risk-radar"  className={({ isActive }) => isActive ? "active" : ""}>Risk Radar</NavLink>
          <NavLink to="/restaking"   className={({ isActive }) => isActive ? "active" : ""}>Restaking</NavLink>
          <NavLink to="/governance"  className={({ isActive }) => isActive ? "active" : ""}>Governance</NavLink>
        </nav>
        <div className="yn-powered">Powered by <strong>Willow</strong> · proofs on every query</div>
      </header>
      <main className="yn-container">
        <Outlet />
      </main>
    </>
  );
}

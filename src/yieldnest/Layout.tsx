import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "../lib/theme";
import "./theme.css";

export function Layout() {
  const [theme, , toggle] = useTheme();
  return (
    <>
      <header className="yn-header">
        <div className="yn-logo">
          <img src="/yieldnest-logo.svg" alt="YieldNest" />
        </div>
        <nav className="yn-nav">
          <NavLink to="/overview"    className={({ isActive }) => isActive ? "active" : ""}>Overview</NavLink>
          <NavLink to="/earn"        className={({ isActive }) => isActive ? "active" : ""}>Earn</NavLink>
          <NavLink to="/portfolio"   className={({ isActive }) => isActive ? "active" : ""}>Portfolio</NavLink>
          <NavLink to="/risk-radar"  className={({ isActive }) => isActive ? "active" : ""}>Risk Radar</NavLink>
          <NavLink to="/restaking"   className={({ isActive }) => isActive ? "active" : ""}>Restaking</NavLink>
          <NavLink to="/governance"  className={({ isActive }) => isActive ? "active" : ""}>Governance</NavLink>
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="yn-powered">Powered by <strong>Willow</strong> · all data is cryptographically verifiable</div>
          <button
            className="yn-theme-toggle"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>
      <main className="yn-container">
        <Outlet />
      </main>
    </>
  );
}

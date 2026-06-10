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
          <div className="yn-powered">Powered by <a href="https://willow.tech" target="_blank" rel="noopener noreferrer"><strong>Willow</strong></a> · all data is cryptographically verifiable</div>
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
      <footer className="yn-footer">
        <span>Live, indexed on-chain data — every result Willow verified.</span>
        <nav className="yn-footer-links" aria-label="Footer">
          <a href="https://yieldnest.finance" target="_blank" rel="noopener noreferrer">yieldnest.finance</a>
          <a href="https://willow.tech" target="_blank" rel="noopener noreferrer">willow.tech</a>
          <a href="https://github.com/willow-network/willow-yieldnest" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://explorer.willow.tech" target="_blank" rel="noopener noreferrer" className="yn-explorer-pill">
            Block explorer
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        </nav>
      </footer>
    </>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./yieldnest/Layout";
import { VerifyProvider } from "./yieldnest/Verify";
import { Overview } from "./pages/Overview";
import { Earn } from "./pages/Earn";
import { Portfolio } from "./pages/Portfolio";
import { RiskRadar } from "./pages/RiskRadar";
import { Restaking } from "./pages/Restaking";
import { Governance } from "./pages/Governance";

export function App() {
  return (
    <BrowserRouter>
      <VerifyProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/"           element={<Navigate to="/overview" replace />} />
            <Route path="/overview"   element={<Overview />} />
            <Route path="/earn"       element={<Earn />} />
            <Route path="/portfolio"  element={<Portfolio />} />
            <Route path="/risk-radar" element={<RiskRadar />} />
            <Route path="/restaking"  element={<Restaking />} />
            <Route path="/governance" element={<Governance />} />
          </Route>
        </Routes>
      </VerifyProvider>
    </BrowserRouter>
  );
}

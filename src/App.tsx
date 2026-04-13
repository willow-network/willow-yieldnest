import { useState } from 'react';
import { DataPanel } from './panels/DataPanel';
import { SubgrovesPanel } from './panels/SubgrovesPanel';
import { QueryPanel } from './panels/QueryPanel';
import { StoreDataPanel } from './panels/StoreDataPanel';
import { ProofInspectorPanel } from './panels/ProofInspectorPanel';
import { StatePanel } from './panels/StatePanel';
import { ValidatorsPanel } from './panels/ValidatorsPanel';
import { GkrVerifyPanel } from './panels/GkrVerifyPanel';
import { AnalyticsPanel } from './panels/AnalyticsPanel';
import { ConnectionBar } from './components/ConnectionBar';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './lib/theme';
import { DEFAULT_API_URL } from './lib/client';

type Tab = 'data' | 'query' | 'analytics' | 'store' | 'subgroves' | 'validators' | 'state' | 'inspector' | 'gkr';

const TABS: { id: Tab; label: string }[] = [
  { id: 'data', label: 'Data' },
  { id: 'query', label: 'Query' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'store', label: 'Store' },
  { id: 'subgroves', label: 'Subgroves' },
  { id: 'validators', label: 'Validators' },
  { id: 'state', label: 'State' },
  { id: 'inspector', label: 'Proof Inspector' },
  { id: 'gkr', label: 'GKR' },
];

export function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [tab, setTab] = useState<Tab>('data');
  const [theme, , toggleTheme] = useTheme();
  const [prefillSubgrove, setPrefillSubgrove] = useState<string | null>(null);
  const [prefillProofHex, setPrefillProofHex] = useState<string | null>(null);

  const jumpToData = (subgroveId: string) => {
    setPrefillSubgrove(subgroveId);
    setTab('data');
  };

  const jumpToInspector = (proofHex: string) => {
    setPrefillProofHex(proofHex);
    setTab('inspector');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <img
            src="/willow-icon.png"
            alt=""
            className="app-logo"
            aria-hidden="true"
          />
          <h1>Willow Explorer</h1>
        </div>
        <div className="header-right">
          <ConnectionBar apiUrl={apiUrl} onApiUrlChange={setApiUrl} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Explorer sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            id={`tab-${t.id}`}
            className={tab === t.id ? 'tab tab-active' : 'tab'}
            onClick={() => setTab(t.id)}
            data-testid={`tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main
        className="app-main"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'data' && (
          <DataPanel
            apiUrl={apiUrl}
            prefillSubgrove={prefillSubgrove}
            onPrefillConsumed={() => setPrefillSubgrove(null)}
            onOpenInInspector={jumpToInspector}
          />
        )}
        {tab === 'query' && (
          <QueryPanel apiUrl={apiUrl} onOpenInInspector={jumpToInspector} />
        )}
        {tab === 'analytics' && <AnalyticsPanel apiUrl={apiUrl} />}
        {tab === 'store' && <StoreDataPanel apiUrl={apiUrl} />}
        {tab === 'subgroves' && (
          <SubgrovesPanel apiUrl={apiUrl} onSubgroveClick={jumpToData} />
        )}
        {tab === 'validators' && <ValidatorsPanel apiUrl={apiUrl} />}
        {tab === 'state' && <StatePanel apiUrl={apiUrl} />}
        {tab === 'gkr' && <GkrVerifyPanel apiUrl={apiUrl} />}
        {tab === 'inspector' && (
          <ProofInspectorPanel
            prefillProofHex={prefillProofHex}
            onPrefillConsumed={() => setPrefillProofHex(null)}
          />
        )}
      </main>

      <footer className="app-footer">
        <span>
          Proof verification: <strong>pure TypeScript</strong> (GroveDB Merk + BLAKE3 via{' '}
          <code>@willow/sdk</code>) — no WASM, no async init
        </span>
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { getClient, getConsensusClient, sign, DEVNET_VALIDATOR1 } from '../lib/client';
import { ExamplesDropdown, Example } from '../components/ExamplesDropdown';

interface Props {
  apiUrl: string;
}

type TxState =
  | { kind: 'idle' }
  | { kind: 'loading'; step: string }
  | { kind: 'ok'; message: string; txHash?: string; roundTripVerified?: boolean }
  | { kind: 'error'; message: string };

export function StoreDataPanel({ apiUrl }: Props) {
  const [regId, setRegId] = useState('');
  const [regName, setRegName] = useState('');
  const [regFunding, setRegFunding] = useState('1');
  const [regState, setRegState] = useState<TxState>({ kind: 'idle' });

  const [storeId, setStoreId] = useState('');
  const [storeKey, setStoreKey] = useState('');
  const [storeValueJson, setStoreValueJson] = useState('{\n  "name": "Alice",\n  "balance": 1000\n}');
  const [storeState, setStoreState] = useState<TxState>({ kind: 'idle' });

  const registerSubgrove = async () => {
    if (!regId || !regName) {
      setRegState({ kind: 'error', message: 'id and name required' });
      return;
    }
    setRegState({ kind: 'loading', step: 'Broadcasting RegisterSubgrove tx…' });
    try {
      const fundingWei = BigInt(Math.floor(parseFloat(regFunding) * 1e18)).toString();
      const consensus = getConsensusClient(apiUrl);
      const result = await consensus.registerSubgrove(
        regId,
        JSON.stringify({ version: 1, fields: {} }),
        DEVNET_VALIDATOR1.did,
        DEVNET_VALIDATOR1.privateKey,
        DEVNET_VALIDATOR1.publicKeyId,
        sign,
        undefined,
        undefined,
        fundingWei,
      );
      if (!storeId) setStoreId(regId);
      setRegState({
        kind: 'ok',
        message: `Subgrove "${regId}" registered.`,
        txHash: result.txHash,
      });
    } catch (err) {
      setRegState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const storeData = async () => {
    if (!storeId || !storeKey) {
      setStoreState({ kind: 'error', message: 'subgrove id and key required' });
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(storeValueJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('value must be a JSON object');
      }
    } catch (err) {
      setStoreState({
        kind: 'error',
        message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    setStoreState({ kind: 'loading', step: 'Broadcasting DataStore tx…' });
    try {
      const consensus = getConsensusClient(apiUrl);
      const result = await consensus.storeData(
        storeId,
        storeKey,
        parsed,
        DEVNET_VALIDATOR1.did,
        DEVNET_VALIDATOR1.privateKey,
        DEVNET_VALIDATOR1.publicKeyId,
        sign,
      );

      setStoreState({ kind: 'loading', step: 'Stored. Round-trip verifying…' });

      // Wait a beat for consensus to finalize, then fetch with verification.
      await new Promise((r) => setTimeout(r, 2000));

      let roundTripVerified = false;
      try {
        const client = getClient(apiUrl);
        const fetched = await client.data.getData(storeId, storeKey);
        roundTripVerified = fetched != null;
      } catch {
        roundTripVerified = false;
      }

      setStoreState({
        kind: 'ok',
        message: `Key "${storeKey}" stored in "${storeId}".`,
        txHash: result.txHash,
        roundTripVerified,
      });
    } catch (err) {
      setStoreState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <section className="panel">
      <h2>Store data (consensus transactions)</h2>
      <p className="panel-description">
        Demonstrates the full write path. Both operations are signed with the devnet
        validator1 Ed25519 key and broadcast to CometBFT as consensus transactions. After the
        store, the panel fetches the key back through the pure-TS GroveDB verifier to confirm
        the write survived end-to-end.
      </p>

      <ExamplesDropdown
        examples={[
          {
            label: '1. Register "user-profiles" subgrove',
            description: 'Sets up a subgrove for storing user data',
            apply: () => { setRegId('user-profiles'); setRegName('User Profiles'); },
          },
          {
            label: '2. Store Alice in user-profiles',
            description: 'Stores a user record with name, email, role',
            apply: () => {
              setStoreId('user-profiles');
              setStoreKey('user:alice');
              setStoreValueJson(JSON.stringify({ name: 'Alice', email: 'alice@example.com', role: 'admin', balance: 50000 }, null, 2));
            },
          },
          {
            label: '3. Store Bob in user-profiles',
            description: 'Another user record to query later',
            apply: () => {
              setStoreId('user-profiles');
              setStoreKey('user:bob');
              setStoreValueJson(JSON.stringify({ name: 'Bob', email: 'bob@example.com', role: 'user', balance: 12500 }, null, 2));
            },
          },
          {
            label: '4. Register "inventory" + Store a product',
            description: 'Different subgrove for product data',
            apply: () => {
              setRegId('inventory');
              setRegName('Product Inventory');
              setStoreId('inventory');
              setStoreKey('product:laptop');
              setStoreValueJson(JSON.stringify({ name: 'ThinkPad X1', price: 1299, stock: 42, category: 'electronics' }, null, 2));
            },
          },
        ] satisfies Example[]}
      />

      <h3 style={{ marginTop: 0 }}>1. Register a subgrove</h3>
      <div className="form-row">
        <label className="form-field">
          <span>subgrove id</span>
          <input
            value={regId}
            onChange={(e) => setRegId(e.target.value)}
            placeholder="my-subgrove"
            spellCheck={false}
            data-testid="store-reg-id"
          />
        </label>
        <label className="form-field">
          <span>display name</span>
          <input
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            placeholder="My Subgrove"
            spellCheck={false}
            data-testid="store-reg-name"
          />
        </label>
        <label className="form-field" style={{ flex: '0 0 140px' }}>
          <span>initial funding (WILL)</span>
          <input
            type="number"
            value={regFunding}
            min={0}
            step={0.1}
            onChange={(e) => setRegFunding(e.target.value)}
            data-testid="store-reg-funding"
          />
        </label>
      </div>
      <div className="form-row">
        <button
          className="btn btn-primary"
          onClick={registerSubgrove}
          disabled={regState.kind === 'loading'}
          data-testid="store-reg-submit"
        >
          {regState.kind === 'loading' ? regState.step : 'Register subgrove'}
        </button>
      </div>

      {regState.kind === 'ok' && (
        <div className="result" data-testid="store-reg-result">
          <div className="result-header">
            <span className="badge badge-ok">✓ registered</span>
          </div>
          <div className="result-body">
            <dl className="kv-list">
              <dt>message</dt>
              <dd>{regState.message}</dd>
              {regState.txHash && (
                <>
                  <dt>tx hash</dt>
                  <dd>
                    <code>{regState.txHash}</code>
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
      )}

      {regState.kind === 'error' && (
        <div className="result" data-testid="store-reg-error">
          <div className="result-header">
            <span className="badge badge-err">✗ error</span>
          </div>
          <pre className="result-body result-body-err">{regState.message}</pre>
        </div>
      )}

      <h3>2. Store a key-value pair</h3>
      <div className="form-row">
        <label className="form-field">
          <span>subgrove id</span>
          <input
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            placeholder="my-subgrove"
            spellCheck={false}
            data-testid="store-data-subgrove"
          />
        </label>
        <label className="form-field">
          <span>key</span>
          <input
            value={storeKey}
            onChange={(e) => setStoreKey(e.target.value)}
            placeholder="user:alice"
            spellCheck={false}
            data-testid="store-data-key"
          />
        </label>
      </div>
      <label className="form-field">
        <span>value (JSON object)</span>
        <textarea
          value={storeValueJson}
          onChange={(e) => setStoreValueJson(e.target.value)}
          rows={5}
          spellCheck={false}
          data-testid="store-data-value"
        />
      </label>
      <div className="form-row">
        <button
          className="btn btn-primary"
          onClick={storeData}
          disabled={storeState.kind === 'loading'}
          data-testid="store-data-submit"
        >
          {storeState.kind === 'loading' ? storeState.step : 'Store & round-trip verify'}
        </button>
      </div>

      {storeState.kind === 'ok' && (
        <div className="result" data-testid="store-data-result">
          <div className="result-header">
            {storeState.roundTripVerified ? (
              <span className="badge badge-ok">✓ stored & round-trip verified</span>
            ) : (
              <span className="badge badge-warn">⚠ stored, round-trip verify pending</span>
            )}
          </div>
          <div className="result-body">
            <dl className="kv-list">
              <dt>message</dt>
              <dd>{storeState.message}</dd>
              {storeState.txHash && (
                <>
                  <dt>tx hash</dt>
                  <dd>
                    <code>{storeState.txHash}</code>
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
      )}

      {storeState.kind === 'error' && (
        <div className="result" data-testid="store-data-error">
          <div className="result-header">
            <span className="badge badge-err">✗ error</span>
          </div>
          <pre className="result-body result-body-err">{storeState.message}</pre>
        </div>
      )}
    </section>
  );
}

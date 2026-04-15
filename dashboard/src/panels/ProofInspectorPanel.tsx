import { useEffect, useState } from 'react';
import { grovedb } from '@willow/sdk';

// These helpers import the pure-TS GroveDB verifier that ships inside
// @willow/sdk. The same decoder runs in Node (jest fixtures) and in the
// browser (here) — byte-for-byte identical to the Rust server output.
const {
  decodeGroveDBProof,
  verifyGroveDBProof,
  hexToBytes,
  bytesToHex,
  hashToHex,
} = grovedb;

type DecodedProof = ReturnType<typeof decodeGroveDBProof>;
type VerifiedProof = ReturnType<typeof verifyGroveDBProof>;

type InspectState =
  | { kind: 'idle' }
  | {
      kind: 'ok';
      decoded: DecodedProof;
      verified: VerifiedProof;
      decodeMs: number;
      verifyMs: number;
      totalMs: number;
    }
  | { kind: 'error'; message: string };

function safeUtf8(bytes: Uint8Array): string {
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/^[\x20-\x7e]+$/.test(decoded)) return decoded;
  } catch {
    /* fallthrough to hex */
  }
  return bytesToHex(bytes);
}

interface LayerLike {
  merkProof: Uint8Array;
  lowerLayers: Map<string, LayerLike>;
}

function LayerNode({
  layer,
  keyLabel,
  isRoot,
}: {
  layer: LayerLike;
  keyLabel: string;
  isRoot: boolean;
}) {
  const children = Array.from(layer.lowerLayers.entries());
  return (
    <div className={isRoot ? 'layer-node layer-node-root' : 'layer-node'}>
      <div>
        <span className="layer-label">layer </span>
        <span className="layer-key">{keyLabel}</span>
      </div>
      <div className="layer-label">
        merk_proof: {layer.merkProof.length} bytes
        {children.length > 0 && (
          <>
            {' · '}
            {children.length} lower layer{children.length === 1 ? '' : 's'}
          </>
        )}
      </div>
      {children.map(([keyHex, child], i) => {
        const keyBytes = hexToBytes(keyHex);
        return (
          <LayerNode
            key={i}
            layer={child as LayerLike}
            keyLabel={safeUtf8(keyBytes)}
            isRoot={false}
          />
        );
      })}
    </div>
  );
}

interface Props {
  prefillProofHex?: string | null;
  onPrefillConsumed?: () => void;
}

export function ProofInspectorPanel({
  prefillProofHex,
  onPrefillConsumed,
}: Props = {}) {
  const [proofHex, setProofHex] = useState('');
  const [state, setState] = useState<InspectState>({ kind: 'idle' });

  useEffect(() => {
    if (prefillProofHex) {
      setProofHex(prefillProofHex);
      setState({ kind: 'idle' });
      onPrefillConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillProofHex]);

  const inspect = () => {
    const trimmed = proofHex.trim();
    if (!trimmed) {
      setState({ kind: 'error', message: 'Proof hex is required' });
      return;
    }
    try {
      const bytes = hexToBytes(trimmed);
      const totalStart = performance.now();

      const decodeStart = performance.now();
      const decoded = decodeGroveDBProof(bytes);
      const decodeMs = performance.now() - decodeStart;

      const verifyStart = performance.now();
      const verified = verifyGroveDBProof(bytes);
      const verifyMs = performance.now() - verifyStart;

      const totalMs = performance.now() - totalStart;
      setState({ kind: 'ok', decoded, verified, decodeMs, verifyMs, totalMs });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ kind: 'error', message });
    }
  };

  const loadSample = () => {
    // The single_key_apps_data_key2 fixture from the SDK's round-trip tests.
    // Root hash: aa068d6ce417b8f333ae37d5b2a15d76758db1e55e91c28d9a0be5bd495e36c4
    setProofHex(
      '00' +
        '3004046170707300080201046461746100860e886db2e4ef92d63a5494c29b478cdaff66222a877aba85e11140b2e8eb18' +
        '0104617070733004046461746100080201046b657932006e847de7825ca924a961b423f377ce6482d155ff8e7b3792f9358e2d2e7eb5d6' +
        '0104646174615d01b9ad411f68f74372787f067986d0fe3d85b416cd6e8e3fd0b0aea14501b2cbbe03046b6579320011000e76616c75652d666f722d6b657932001001' +
        '2dddaa863ff4e92d8e017a1e8ad419eafd02d4f2fb82faa786b285bda093052411' +
        '0001',
    );
  };

  const clear = () => {
    setProofHex('');
    setState({ kind: 'idle' });
  };

  return (
    <section className="panel">
      <h2>Proof Inspector</h2>
      <p className="panel-description">
        Paste any <code>GroveDBProof</code> hex and decode it with the pure-TS verifier shipped
        in <code>@willow/sdk</code>. Shows the layer tree, merk-proof sizes per layer, proven
        (path, key, value) triples, and the computed root hash — all in your browser, no
        server round-trip. This is the same decoder the SDK's <code>verifyItemProof</code>{' '}
        calls on the Data panel.
      </p>

      <label className="form-field">
        <span>proof hex</span>
        <textarea
          value={proofHex}
          onChange={(e) => setProofHex(e.target.value)}
          rows={6}
          placeholder="00300404617070... (paste a hex-encoded GroveDBProof)"
          spellCheck={false}
          data-testid="inspector-input"
        />
      </label>

      <div className="form-row">
        <button
          className="btn btn-primary"
          onClick={inspect}
          data-testid="inspector-decode"
        >
          Decode & verify
        </button>
        <button className="btn btn-ghost" onClick={loadSample} data-testid="inspector-sample">
          Load sample
        </button>
        <button className="btn btn-ghost" onClick={clear} data-testid="inspector-clear">
          Clear
        </button>
      </div>

      {state.kind === 'ok' && (
        <div className="result" data-testid="inspector-result">
          <div className="result-header">
            <span className="badge badge-ok">✓ decoded &amp; verified</span>
            <div className="result-header-right">
              <span title="decode + verify total">
                total {state.totalMs.toFixed(2)} ms
              </span>
            </div>
          </div>
          <div className="result-body">
            <dl className="kv-list">
              <dt>version</dt>
              <dd>V{state.decoded.version}</dd>
              <dt>computed root hash</dt>
              <dd>
                <code data-testid="inspector-root">
                  {hashToHex(state.verified.rootHash)}
                </code>
              </dd>
              <dt>proven entries</dt>
              <dd data-testid="inspector-count">{state.verified.results.length}</dd>
              <dt>timing</dt>
              <dd>
                <span>
                  decode <strong>{state.decodeMs.toFixed(2)} ms</strong>, verify{' '}
                  <strong>{state.verifyMs.toFixed(2)} ms</strong>
                </span>
              </dd>
            </dl>

            <h3>Layer tree</h3>
            <div className="layer-tree">
              <LayerNode
                layer={state.decoded.proof.rootLayer as LayerLike}
                keyLabel="(root)"
                isRoot
              />
            </div>

            {state.verified.results.length > 0 && (
              <>
                <h3>Proven entries</h3>
                {state.verified.results.map((r, i) => (
                  <div key={i} className="collapsible">
                    <div className="collapsible-body">
                      <dl className="kv-list">
                        <dt>path</dt>
                        <dd>
                          {r.path.length === 0 ? (
                            <em>(root)</em>
                          ) : (
                            r.path.map((seg, j) => (
                              <span key={j}>
                                <code>{safeUtf8(seg)}</code>
                                {j < r.path.length - 1 ? ' / ' : ''}
                              </span>
                            ))
                          )}
                        </dd>
                        <dt>key</dt>
                        <dd>
                          <code>{safeUtf8(r.key)}</code>
                        </dd>
                        <dt>value</dt>
                        <dd>
                          {r.value ? (
                            <code>
                              {r.value.length} bytes — {safeUtf8(r.value)}
                            </code>
                          ) : (
                            <em>null (absence proof)</em>
                          )}
                        </dd>
                      </dl>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="result" data-testid="inspector-error">
          <div className="result-header">
            <span className="badge badge-err">✗ decode failed</span>
          </div>
          <pre className="result-body result-body-err">{state.message}</pre>
        </div>
      )}
    </section>
  );
}

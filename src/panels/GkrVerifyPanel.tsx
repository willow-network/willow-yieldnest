import { useState } from 'react';

interface Props {
  apiUrl: string;
}

interface VerifyResult {
  valid: boolean;
  error?: string | null;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; result: VerifyResult; latencyMs: number }
  | { kind: 'error'; message: string };

const HEX32_PLACEHOLDER = '0'.repeat(64);

export function GkrVerifyPanel({ apiUrl }: Props) {
  const [proofHex, setProofHex] = useState('');
  const [vkHash, setVkHash] = useState('');
  const [inputCommitment, setInputCommitment] = useState('');
  const [outputRoot, setOutputRoot] = useState('');
  const [startBlock, setStartBlock] = useState('');
  const [endBlock, setEndBlock] = useState('');
  const [configHash, setConfigHash] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  const verify = async () => {
    if (!proofHex || !vkHash || !inputCommitment || !outputRoot || !configHash) {
      setState({ kind: 'error', message: 'all hex fields are required' });
      return;
    }
    const startNum = Number(startBlock);
    const endNum = Number(endBlock);
    if (!Number.isFinite(startNum) || !Number.isFinite(endNum)) {
      setState({ kind: 'error', message: 'block_range must be numeric' });
      return;
    }

    setState({ kind: 'loading' });
    const started = performance.now();
    try {
      const res = await fetch(`${apiUrl}/verify-gkr-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof: proofHex.trim(),
          verification_key_hash: vkHash.trim(),
          public_inputs: {
            input_commitment: inputCommitment.trim(),
            output_root: outputRoot.trim(),
            block_range: [startNum, endNum],
            config_hash: configHash.trim(),
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const result: VerifyResult = body?.data ?? body;
      const latencyMs = Math.round(performance.now() - started);
      setState({ kind: 'ok', result, latencyMs });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <section className="panel">
      <h2>GKR verification (server-assisted)</h2>
      <p className="panel-description">
        The full Expander GKR verifier currently can't run in-browser — the underlying Rust
        crate has an unconditional MPI dep and native SIMD arithmetic with no{' '}
        <code>wasm32</code> fallback. Until that upstream work lands, browser clients post the
        proof bytes and public inputs to <code>POST /verify-gkr-proof</code> on the Willow API
        server, which runs the real Rust verifier and returns a boolean. GroveDB Merk and
        CometBFT light-client verification still run fully in-browser (see the other panels) —
        only GKR falls back to server trust.
      </p>

      <label className="form-field">
        <span>proof hex</span>
        <textarea
          value={proofHex}
          onChange={(e) => setProofHex(e.target.value)}
          rows={4}
          placeholder="raw GKR proof bytes, hex-encoded"
          spellCheck={false}
          data-testid="gkr-proof"
        />
      </label>

      <label className="form-field">
        <span>verification_key_hash (32 bytes hex)</span>
        <input
          value={vkHash}
          onChange={(e) => setVkHash(e.target.value)}
          placeholder={HEX32_PLACEHOLDER}
          spellCheck={false}
          data-testid="gkr-vk-hash"
        />
      </label>

      <div className="form-row">
        <label className="form-field">
          <span>input_commitment (32 bytes hex)</span>
          <input
            value={inputCommitment}
            onChange={(e) => setInputCommitment(e.target.value)}
            placeholder={HEX32_PLACEHOLDER}
            spellCheck={false}
            data-testid="gkr-input-commit"
          />
        </label>
        <label className="form-field">
          <span>output_root (32 bytes hex)</span>
          <input
            value={outputRoot}
            onChange={(e) => setOutputRoot(e.target.value)}
            placeholder={HEX32_PLACEHOLDER}
            spellCheck={false}
            data-testid="gkr-output-root"
          />
        </label>
      </div>

      <div className="form-row">
        <label className="form-field">
          <span>start_block</span>
          <input
            type="number"
            value={startBlock}
            onChange={(e) => setStartBlock(e.target.value)}
            placeholder="0"
            data-testid="gkr-start-block"
          />
        </label>
        <label className="form-field">
          <span>end_block</span>
          <input
            type="number"
            value={endBlock}
            onChange={(e) => setEndBlock(e.target.value)}
            placeholder="100"
            data-testid="gkr-end-block"
          />
        </label>
        <label className="form-field">
          <span>config_hash (32 bytes hex)</span>
          <input
            value={configHash}
            onChange={(e) => setConfigHash(e.target.value)}
            placeholder={HEX32_PLACEHOLDER}
            spellCheck={false}
            data-testid="gkr-config-hash"
          />
        </label>
      </div>

      <div className="form-row">
        <button
          className="btn btn-primary"
          onClick={verify}
          disabled={state.kind === 'loading'}
          data-testid="gkr-verify-submit"
        >
          {state.kind === 'loading' ? 'Verifying…' : 'Verify'}
        </button>
      </div>

      {state.kind === 'ok' && (
        <div className="result" data-testid="gkr-result">
          <div className="result-header">
            {state.result.valid ? (
              <span className="badge badge-ok">✓ proof valid (server-verified)</span>
            ) : (
              <span className="badge badge-err">✗ proof invalid</span>
            )}
            <div className="result-header-right">
              <span className="result-latency">{state.latencyMs} ms</span>
            </div>
          </div>
          <div className="result-body">
            <dl className="kv-list">
              <dt>valid</dt>
              <dd>
                <code>{String(state.result.valid)}</code>
              </dd>
              {state.result.error && (
                <>
                  <dt>error</dt>
                  <dd>
                    <code>{state.result.error}</code>
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="result" data-testid="gkr-error">
          <div className="result-header">
            <span className="badge badge-err">✗ request failed</span>
          </div>
          <pre className="result-body result-body-err">{state.message}</pre>
        </div>
      )}
    </section>
  );
}

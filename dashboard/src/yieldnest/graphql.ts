// GraphQL client for the Willow indexer-node query endpoint.
// In dev we go through Vite's /indexer-gql proxy (see vite.config.ts).

const GQL_BASE = (import.meta as any).env?.VITE_INDEXER_GQL ?? "/indexer-gql";

export class NoIndexingProgressError extends Error {
  constructor(subgrove: string) {
    super(`no indexing progress for ${subgrove}`);
    this.name = "NoIndexingProgressError";
  }
}

export type WillowProof = {
  merkle_proofs: Array<{ key: string; value_hash: number[]; path: string; siblings: any[]; merkle_proof: number[] }>;
  state_root: number[];
  block_height: number;
  ethereum_anchor: null | { block_number: number; tx_hash: number[]; contract: string };
};

// Abort a request that hangs too long (e.g. the query path starved during a
// heavy backfill) so the UI can show a "catching up" state and the poll loop
// can retry, instead of spinning forever on one stuck request. Default suits
// the proof path (per-entity proving is legitimately slow); display callers
// that retry on their own pass a tighter budget.
const DEFAULT_QUERY_TIMEOUT_MS = 25000;

async function gqlFetch<T>(
  subgrove: string, query: string, includeProof: boolean,
  timeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<{ data: T; proof: WillowProof | null }> {
  // The timer stays armed through the body read — a response that sends
  // headers then stalls the stream must still abort, or the caller's poll
  // loop hangs on a promise that never settles.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${GQL_BASE}/graphql/${subgrove}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, include_proof: includeProof }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      if (r.status === 404 || r.status === 500) {
        const text = await r.text().catch(() => "");
        if (text.includes("No indexing progress")) throw new NoIndexingProgressError(subgrove);
      }
      throw new Error(`gql ${subgrove}: HTTP ${r.status}`);
    }
    const body = await r.json();
    if (body.errors) {
      const msg = body.errors.map((e: any) => e.message).join("; ");
      if (msg.includes("No indexing progress")) throw new NoIndexingProgressError(subgrove);
      throw new Error(msg);
    }
    return { data: body.data as T, proof: (body.proof ?? null) as WillowProof | null };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`gql ${subgrove}: timed out (indexer busy)`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Display path — fetch data only. Sends `include_proof: false` so the indexer
 * serves the result WITHOUT generating a per-entity Merkle proof for every row
 * (one `prove_query` per entity) and WITHOUT the proof-consistency retry loop —
 * both of which are pure overhead when we're only rendering. Verification is on
 * demand, per entity, via `runQueryWithProof` (the proof viewer).
 */
export async function runQuery<T = any>(
  subgrove: string, query: string, opts?: { timeoutMs?: number },
): Promise<T> {
  const { data } = await gqlFetch<T>(subgrove, query, false, opts?.timeoutMs);
  return data;
}

/**
 * Verification path — fetch one entity together with its Merkle proof, so the
 * browser can recompute the root and check it against the committed state root.
 */
export async function runQueryWithProof<T = any>(
  subgrove: string, query: string,
): Promise<{ data: T; proof: WillowProof | null }> {
  return gqlFetch<T>(subgrove, query, true);
}

export function bytesToHex(bytes: number[]): string {
  return "0x" + bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

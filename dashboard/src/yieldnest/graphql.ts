// GraphQL client for the Willow indexer-node historical query endpoint.
// In dev we go through Vite's /indexer-gql proxy (see vite.config.ts).

const GQL_BASE = (import.meta as any).env?.VITE_INDEXER_GQL ?? "/indexer-gql";

export class NoIndexingProgressError extends Error {
  constructor(subgrove: string) {
    super(`no indexing progress for ${subgrove}`);
    this.name = "NoIndexingProgressError";
  }
}

export type WillowProof = {
  merkle_proofs: Array<{ key: string; value_hash: number[]; path: string; siblings: any[] }>;
  state_root: number[];
  block_height: number;
  ethereum_anchor: null | { block_number: number; tx_hash: number[]; contract: string };
};

export async function runQuery<T = any>(subgrove: string, query: string): Promise<T> {
  const { data } = await runQueryWithProof<T>(subgrove, query);
  return data;
}

export async function runQueryWithProof<T = any>(
  subgrove: string, query: string,
): Promise<{ data: T; proof: WillowProof | null }> {
  const r = await fetch(`${GQL_BASE}/graphql/${subgrove}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
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
}

export function bytesToHex(bytes: number[]): string {
  return "0x" + bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

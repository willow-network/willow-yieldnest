// Thin client for the Willow REST API — calls /subgroves directly (the
// @willow/sdk TypeScript client doesn't expose a listSubgroves helper yet).

// In dev, go through Vite's /willow-api proxy (see vite.config.ts) to dodge CORS.
// In prod, point VITE_WILLOW_API at the real REST endpoint.
const NODE = (import.meta as any).env?.VITE_WILLOW_API ?? "/willow-api";

export type Subgrove = {
  subgrove_id: string;
  name: string;
  description: string;
  owner_did: string;
  admins: string[];
  retention_window: unknown;
  created_at: number;
  updated_at: number;
};

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${NODE}${path}`);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  const body = await r.json();
  if (body?.success === false) throw new Error(body.error ?? "unknown error");
  return body.data as T;
}

export function listSubgroves(): Promise<Subgrove[]> {
  return getJson<Subgrove[]>("/subgroves");
}

export function getSubgrove(id: string): Promise<Subgrove> {
  return getJson<Subgrove>(`/subgroves/${id}`);
}

export const nodeUrl = () => NODE;

// Indexer's REST surface (different origin than the validator REST API).
const INDEXER = (import.meta as any).env?.VITE_INDEXER_GQL ?? "/indexer-gql";

export type GkrStateBalance = { address: string; balance: string };

export type GkrState = {
  subgrove_id: string;
  last_block: number;
  output_root: string;
  balances: GkrStateBalance[];
  verification: string;
};

export async function getGkrState(subgroveId: string): Promise<GkrState | null> {
  const r = await fetch(`${INDEXER}/gkr-state/${subgroveId}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`/gkr-state/${subgroveId}: HTTP ${r.status}`);
  return (await r.json()) as GkrState;
}

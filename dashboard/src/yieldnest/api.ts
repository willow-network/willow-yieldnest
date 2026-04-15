// Thin client for the Willow REST API. The @willow/sdk TypeScript client
// doesn't yet expose a listSubgroves helper, so we call /subgroves directly.
// Swap this module out for sdk calls once that lands.

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

// Browser shim for Node's `crypto`. The vendored @willow/sdk statically imports
// `createHash` (sha256) for SERVER-SIDE consensus anchoring, which the dashboard
// never runs in the browser — the GroveDB proof verifier uses pure-JS blake3.
// This satisfies the import; any unexpected call fails loudly rather than
// silently producing a wrong hash.
export function createHash(_algo?: string) {
  return {
    update() {
      return this;
    },
    digest(): never {
      throw new Error("crypto.createHash is unavailable in the browser build (server-side only)");
    },
  };
}

export default { createHash };

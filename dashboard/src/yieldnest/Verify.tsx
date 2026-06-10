import { createContext, useContext, useState, ReactNode } from "react";
import { ProofViewer } from "./ProofViewer";

/**
 * App-level verification surface. Any element — a row badge, a subgrove pill, a
 * chart point — calls `useVerify().verify(target)` to open the proof viewer,
 * which fetches that entity's Merkle proof and re-checks it in the browser.
 * One modal is mounted for the whole app so every verifiable thing shares it.
 */
export type VerifyTarget = {
  subgrove: string;
  entityType: string;
  entityId: string;
  entityIdField?: string;
};

type Ctx = { verify: (t: VerifyTarget) => void };
const VerifyCtx = createContext<Ctx>({ verify: () => {} });

export function useVerify() {
  return useContext(VerifyCtx);
}

export function VerifyProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<VerifyTarget | null>(null);
  return (
    <VerifyCtx.Provider value={{ verify: setTarget }}>
      {children}
      {target && (
        <ProofViewer
          subgrove={target.subgrove}
          entityType={target.entityType}
          entityIdField={target.entityIdField ?? "id"}
          entityId={target.entityId}
          onClose={() => setTarget(null)}
        />
      )}
    </VerifyCtx.Provider>
  );
}

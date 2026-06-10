import { createContext, useContext, useState, ReactNode } from "react";
import { ProofViewer } from "./ProofViewer";
import { BatchVerifyViewer } from "./BatchVerifyViewer";

/**
 * App-level verification surface. Any element — a row badge, a subgrove pill, a
 * chart point — calls `useVerify()` to open a proof viewer that re-checks the
 * data in the browser. `verify` checks one entity; `verifySet` checks every
 * proof behind an aggregate (with a live count). One modal is mounted for the
 * whole app so every verifiable thing shares it.
 */
export type VerifyTarget = {
  subgrove: string;
  entityType: string;
  entityId: string;
  entityIdField?: string;
};

export type VerifySetTarget = {
  subgrove: string;
  /** Query whose full result set backs the aggregate. */
  query: string;
  /** Human label for the aggregate (e.g. "Total TVL"). */
  label: string;
};

type Ctx = {
  verify: (t: VerifyTarget) => void;
  verifySet: (t: VerifySetTarget) => void;
};
const VerifyCtx = createContext<Ctx>({ verify: () => {}, verifySet: () => {} });

export function useVerify() {
  return useContext(VerifyCtx);
}

export function VerifyProvider({ children }: { children: ReactNode }) {
  const [entity, setEntity] = useState<VerifyTarget | null>(null);
  const [set, setSet] = useState<VerifySetTarget | null>(null);
  return (
    <VerifyCtx.Provider value={{ verify: setEntity, verifySet: setSet }}>
      {children}
      {entity && (
        <ProofViewer
          subgrove={entity.subgrove}
          entityType={entity.entityType}
          entityIdField={entity.entityIdField ?? "id"}
          entityId={entity.entityId}
          onClose={() => setEntity(null)}
        />
      )}
      {set && (
        <BatchVerifyViewer
          subgrove={set.subgrove}
          query={set.query}
          label={set.label}
          onClose={() => setSet(null)}
        />
      )}
    </VerifyCtx.Provider>
  );
}

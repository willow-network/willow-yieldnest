import { useState } from "react";

export function CopyAddress({ addr, chars = 10 }: { addr: string; chars?: number }) {
  const [copied, setCopied] = useState(false);
  const short = `${addr.slice(0, chars)}…${addr.slice(-6)}`;
  const copy = () => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span
      onClick={copy}
      title={`${addr}\n\nClick to copy`}
      style={{
        fontFamily: "monospace",
        fontSize: 12,
        cursor: "pointer",
        borderBottom: "1px dotted var(--yn-text-dim)",
      }}
    >
      {copied ? "copied!" : short}
    </span>
  );
}

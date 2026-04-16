/**
 * Standard page-size options for GraphQL `first:` pagination across the
 * dashboard. Exposed as a user-visible control so slow-loading screens
 * can be narrowed without editing code.
 */
export const PAGE_SIZE_OPTIONS = [100, 500, 1000, 2500, 5000] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 1000;

export function PageSizeSelector({
  value,
  onChange,
  label = "Window",
}: {
  value: PageSize;
  onChange: (n: PageSize) => void;
  label?: string;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        color: "var(--yn-text-dim)",
      }}
    >
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as PageSize)}
        style={{
          background: "var(--yn-surface)",
          color: "var(--yn-text)",
          border: "1px solid var(--yn-border)",
          borderRadius: 6,
          padding: "4px 8px",
          fontFamily: "inherit",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n.toLocaleString()}
          </option>
        ))}
      </select>
    </label>
  );
}

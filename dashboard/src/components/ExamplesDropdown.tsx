import { useState, useRef, useEffect } from 'react';

export interface Example {
  label: string;
  description?: string;
  apply: () => void;
}

interface Props {
  examples: Example[];
}

export function ExamplesDropdown({ examples }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="examples-dropdown" ref={ref}>
      <button
        className="btn btn-ghost"
        onClick={() => setOpen(!open)}
        data-testid="examples-toggle"
      >
        Examples ▾
      </button>
      {open && (
        <div className="examples-menu" data-testid="examples-menu">
          {examples.map((ex, i) => (
            <button
              key={i}
              className="examples-item"
              onClick={() => {
                ex.apply();
                setOpen(false);
              }}
              data-testid={`example-${i}`}
            >
              <span className="examples-item-label">{ex.label}</span>
              {ex.description && (
                <span className="examples-item-desc">{ex.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

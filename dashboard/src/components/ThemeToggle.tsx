import type { Theme } from '../lib/theme';

interface Props {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: Props) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      data-testid="theme-toggle"
      data-theme-current={theme}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}

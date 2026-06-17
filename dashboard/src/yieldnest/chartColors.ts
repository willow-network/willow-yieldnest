import { useEffect, useState } from "react";

// Chart series colors live in JS (recharts takes them as props, not CSS), so they
// can't read the --yn-* CSS vars. This hook makes them theme-aware instead: DARK is
// the original palette (unchanged), LIGHT is the refreshed emerald palette so light
// charts match the new accent. It tracks <html data-theme> so it follows the toggle.
export type ChartColors = {
  green: string;      // primary line / area / bar
  greenDark: string;  // secondary bars (top depositors, top holders), radar stroke
  greenLight: string; // brighter accent
  palette: string[];  // categorical slices (donut)
};

const DARK: ChartColors = {
  green: "#4ea882",
  greenDark: "#2c7a5c",
  greenLight: "#7acba7",
  palette: ["#4ea882", "#2c7a5c", "#7acba7", "#b45309", "#5a6b60", "#c5d6ca"],
};

const LIGHT: ChartColors = {
  green: "#0a7d59",
  greenDark: "#0a7d59",  // single-series charts use the same emerald as the verified pill / accent
  greenLight: "#10b07f",
  // Green-family categorical palette (mirrors the dark theme's look: a green ramp + amber + neutrals),
  // tuned for white. Avoids the blue/violet that read as off-brand on light.
  palette: ["#0a7d59", "#5fc7a0", "#0c5d43", "#b45309", "#5a6b60", "#9fb0a8"],
};

function current(): ChartColors {
  return document.documentElement.getAttribute("data-theme") === "dark" ? DARK : LIGHT;
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(current);
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(current()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return colors;
}

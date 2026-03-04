import process from "node:process";

export type ThemeVariant = "dark" | "light";

export interface Theme {
  readonly variant: ThemeVariant;
  readonly accent: string;
  readonly accentSoft: string;
  readonly danger: string;
  readonly warning: string;
  readonly info: string;
  readonly success: string;
  readonly muted: string;
}

const darkTheme: Theme = {
  variant: "dark",
  accent: "#7dd3fc",
  accentSoft: "#38bdf8",
  danger: "#f97373",
  warning: "#facc15",
  info: "#60a5fa",
  success: "#4ade80",
  muted: "#6b7280",
};

const lightTheme: Theme = {
  variant: "light",
  accent: "#0369a1",
  accentSoft: "#0284c7",
  danger: "#b91c1c",
  warning: "#b45309",
  info: "#1d4ed8",
  success: "#16a34a",
  muted: "#6b7280",
};

/**
 * Detect whether colors should be disabled entirely.
 *
 * We follow the widely-used `NO_COLOR` convention and also respect terminals
 * that report no color support.
 */
export function colorsDisabled(): boolean {
  if (process.env.NO_COLOR) return true;
  if (!process.stdout.isTTY) return true;
  // Very old terminals may not support colors; Ink performs its own detection
  // as well, so this is just a minimal guard.
  return false;
}

export function detectThemeVariant(): ThemeVariant {
  const env = process.env.CURIO_CODE_THEME?.toLowerCase();
  if (env === "dark" || env === "light") return env;

  // Simple heuristic: assume dark background when TERM_PROGRAM is a modern
  // terminal and no explicit preference is set. This can be expanded later
  // when we add a persisted config file.
  return "dark";
}

export function getActiveTheme(): Theme {
  const variant = detectThemeVariant();
  return variant === "dark" ? darkTheme : lightTheme;
}


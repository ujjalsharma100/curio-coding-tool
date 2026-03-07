import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import process from "node:process";

export type ThemeVariant = "dark" | "light";
export type ColorDepth = "none" | "basic" | "256" | "truecolor";

export interface Theme {
  readonly variant: ThemeVariant;
  readonly accent: string;
  readonly accentSoft: string;
  readonly danger: string;
  readonly warning: string;
  readonly info: string;
  readonly success: string;
  readonly muted: string;
  /** Background color for user message blocks */
  readonly userMessageBg: string;
  /** Border color for the input container */
  readonly inputBorder: string;
  /** Background color for popup menus (command menu, model picker) */
  readonly menuBg: string;
  /** Background color for highlighted/selected menu item */
  readonly menuHighlight: string;
  /** Dim/secondary text color */
  readonly dim: string;
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
  userMessageBg: "#1e293b",
  inputBorder: "#475569",
  menuBg: "#1e293b",
  menuHighlight: "#334155",
  dim: "#4b5563",
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
  userMessageBg: "#f1f5f9",
  inputBorder: "#94a3b8",
  menuBg: "#f8fafc",
  menuHighlight: "#e2e8f0",
  dim: "#9ca3af",
};

/* ── ANSI basic-16 fallback theme for terminals without truecolor ── */

const darkThemeBasic: Theme = {
  variant: "dark",
  accent: "cyan",
  accentSoft: "cyanBright",
  danger: "red",
  warning: "yellow",
  info: "blue",
  success: "green",
  muted: "gray",
  userMessageBg: "gray",
  inputBorder: "gray",
  menuBg: "gray",
  menuHighlight: "white",
  dim: "gray",
};

const lightThemeBasic: Theme = {
  variant: "light",
  accent: "blueBright",
  accentSoft: "blue",
  danger: "red",
  warning: "yellow",
  info: "blueBright",
  success: "green",
  muted: "gray",
  userMessageBg: "white",
  inputBorder: "gray",
  menuBg: "white",
  menuHighlight: "gray",
  dim: "gray",
};

/* ── Color depth detection ────────────────────────────────────────── */

export function detectColorDepth(): ColorDepth {
  if (process.env.NO_COLOR) return "none";
  if (!process.stdout.isTTY) return "none";

  if (
    process.env.COLORTERM === "truecolor" ||
    process.env.COLORTERM === "24bit"
  ) {
    return "truecolor";
  }

  const term = process.env.TERM ?? "";
  if (term.includes("256color")) return "256";

  const termProgram = process.env.TERM_PROGRAM?.toLowerCase() ?? "";
  const truecolorTerminals = [
    "iterm",
    "hyper",
    "vscode",
    "kitty",
    "wezterm",
    "alacritty",
    "ghostty",
  ];
  if (truecolorTerminals.some((t) => termProgram.includes(t))) {
    return "truecolor";
  }

  if (process.stdout.isTTY) return "basic";
  return "none";
}

export function colorsDisabled(): boolean {
  return detectColorDepth() === "none";
}

/* ── Theme config file loading ────────────────────────────────────── */

interface ThemeConfigFile {
  variant?: ThemeVariant;
  accent?: string;
  accentSoft?: string;
  danger?: string;
  warning?: string;
  info?: string;
  success?: string;
  muted?: string;
  userMessageBg?: string;
  inputBorder?: string;
  menuBg?: string;
  menuHighlight?: string;
  dim?: string;
}

function loadThemeConfigFile(): ThemeConfigFile | null {
  const configPath = join(homedir(), ".curio-code", "theme.json");
  try {
    if (!existsSync(configPath)) return null;
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as ThemeConfigFile;
  } catch {
    return null;
  }
}

function applyOverrides(base: Theme, overrides: ThemeConfigFile): Theme {
  return {
    variant: overrides.variant ?? base.variant,
    accent: overrides.accent ?? base.accent,
    accentSoft: overrides.accentSoft ?? base.accentSoft,
    danger: overrides.danger ?? base.danger,
    warning: overrides.warning ?? base.warning,
    info: overrides.info ?? base.info,
    success: overrides.success ?? base.success,
    muted: overrides.muted ?? base.muted,
    userMessageBg: overrides.userMessageBg ?? base.userMessageBg,
    inputBorder: overrides.inputBorder ?? base.inputBorder,
    menuBg: overrides.menuBg ?? base.menuBg,
    menuHighlight: overrides.menuHighlight ?? base.menuHighlight,
    dim: overrides.dim ?? base.dim,
  };
}

/* ── Public API ────────────────────────────────────────────────────── */

export function detectThemeVariant(): ThemeVariant {
  const env = process.env.CURIO_CODE_THEME?.toLowerCase();
  if (env === "dark" || env === "light") return env;

  const cfg = loadThemeConfigFile();
  if (cfg?.variant === "dark" || cfg?.variant === "light") return cfg.variant;

  return "dark";
}

export function getActiveTheme(): Theme {
  const variant = detectThemeVariant();
  const colorDepth = detectColorDepth();
  const useBasic = colorDepth === "basic" || colorDepth === "none";

  let base: Theme;
  if (variant === "dark") {
    base = useBasic ? darkThemeBasic : darkTheme;
  } else {
    base = useBasic ? lightThemeBasic : lightTheme;
  }

  const cfg = loadThemeConfigFile();
  if (cfg) {
    return applyOverrides(base, cfg);
  }

  return base;
}


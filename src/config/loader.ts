import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { ConfigSchema, CONFIG_DEFAULTS, type CurioConfig } from "./schema.js";

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

export function getCurioHome(): string {
  return process.env.CURIO_CODE_HOME ?? join(homedir(), ".curio-code");
}

export function getConfigPaths(projectRoot?: string): {
  global: string;
  project: string | null;
} {
  const globalPath =
    process.env.CURIO_CODE_CONFIG ?? join(getCurioHome(), "config.json");
  const projectPath = projectRoot
    ? join(projectRoot, ".curio-code", "config.json")
    : null;
  return { global: globalPath, project: projectPath };
}

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Env var overrides — higher priority than config files
// ---------------------------------------------------------------------------

function envOverrides(): Partial<Record<string, unknown>> {
  const overrides: Record<string, unknown> = {};
  if (process.env.CURIO_CODE_MODEL) overrides.model = process.env.CURIO_CODE_MODEL;
  if (process.env.CURIO_CODE_PROVIDER) overrides.provider = process.env.CURIO_CODE_PROVIDER;
  if (process.env.CURIO_CODE_PERMISSION_MODE) overrides.permissionMode = process.env.CURIO_CODE_PERMISSION_MODE;
  if (process.env.CURIO_CODE_NO_MEMORY) overrides.memory = { enabled: false, autoSave: false };
  if (process.env.CURIO_CODE_MAX_TURNS) {
    const n = Number.parseInt(process.env.CURIO_CODE_MAX_TURNS, 10);
    if (!Number.isNaN(n)) overrides.maxTurns = n;
  }
  if (process.env.CURIO_CODE_THEME) overrides.theme = process.env.CURIO_CODE_THEME;
  if (process.env.DEBUG) overrides._debug = true;
  return overrides;
}

// ---------------------------------------------------------------------------
// Deep merge (simple 1-level)
// ---------------------------------------------------------------------------

function deepMerge(
  ...objects: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const obj of objects) {
    if (!obj) continue;
    for (const [key, value] of Object.entries(obj)) {
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        result[key] !== null &&
        typeof result[key] === "object" &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else if (value !== undefined) {
        result[key] = value;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Config loading — merge order: defaults ← global ← project ← env ← CLI
// ---------------------------------------------------------------------------

export interface LoadConfigOptions {
  projectRoot?: string;
  cliOverrides?: Partial<CurioConfig>;
}

export interface LoadedConfig {
  config: CurioConfig;
  globalPath: string;
  projectPath: string | null;
  globalExists: boolean;
  projectExists: boolean;
  errors: string[];
}

export function loadConfig(options?: LoadConfigOptions): LoadedConfig {
  const paths = getConfigPaths(options?.projectRoot);
  const errors: string[] = [];

  const globalRaw = readJsonFile(paths.global);
  const projectRaw = paths.project ? readJsonFile(paths.project) : null;
  const envRaw = envOverrides();

  const merged = deepMerge(
    CONFIG_DEFAULTS as unknown as Record<string, unknown>,
    globalRaw,
    projectRaw,
    envRaw,
    options?.cliOverrides as Record<string, unknown> | undefined,
  );

  const parsed = ConfigSchema.safeParse(merged);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`Config: ${issue.path.join(".")}: ${issue.message}`);
    }
    return {
      config: CONFIG_DEFAULTS,
      globalPath: paths.global,
      projectPath: paths.project,
      globalExists: globalRaw !== null,
      projectExists: projectRaw !== null,
      errors,
    };
  }

  return {
    config: parsed.data,
    globalPath: paths.global,
    projectPath: paths.project,
    globalExists: globalRaw !== null,
    projectExists: projectRaw !== null,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Config value getter — dot-notation key lookup
// ---------------------------------------------------------------------------

export function getConfigValue(
  config: CurioConfig,
  key: string,
): unknown {
  const parts = key.split(".");
  let current: unknown = config;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ---------------------------------------------------------------------------
// `curio-code init` — create .curio-code/config.json with defaults
// ---------------------------------------------------------------------------

export function initProjectConfig(projectRoot: string): string {
  const dir = join(projectRoot, ".curio-code");
  const configPath = join(dir, "config.json");

  if (existsSync(configPath)) {
    return `Config already exists at ${configPath}`;
  }

  mkdirSync(dir, { recursive: true });

  const defaultConfig = {
    model: "anthropic:claude-sonnet-4-6",
    permissionMode: "ask",
    theme: "dark",
    memory: { enabled: true, autoSave: true },
  };

  writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + "\n", "utf-8");
  return `Created ${configPath}`;
}

// ---------------------------------------------------------------------------
// Config file writing — for /config set
// ---------------------------------------------------------------------------

export function setConfigValue(
  filePath: string,
  key: string,
  value: unknown,
): void {
  let existing: Record<string, unknown> = {};
  try {
    if (existsSync(filePath)) {
      existing = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    }
  } catch {
    existing = {};
  }

  const parts = key.split(".");
  let current: Record<string, unknown> = existing;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;

  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
}

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";

// ── 10.1 Config Schema & Loader ──────────────────────────────────────────

import { ConfigSchema, CONFIG_DEFAULTS, type CurioConfig } from "../../src/config/schema.js";
import {
  loadConfig,
  getConfigValue,
  initProjectConfig,
  setConfigValue,
  getCurioHome,
  getConfigPaths,
} from "../../src/config/loader.js";

// ── 10.3 Hooks ──────────────────────────────────────────────────────────

import {
  buildHookSystem,
  formatCostSummary,
  type CostTracker,
} from "../../src/hooks/hook-manager.js";

// ── 10.5 Slash Commands ─────────────────────────────────────────────────

import {
  handleSlashCommand,
  isSlashCommand,
  getSlashCommandCompletions,
  type SlashCommandContext,
} from "../../src/cli/commands/slash-commands.js";

// ═══════════════════════════════════════════════════════════════════════════
// 10.1 Configuration Files
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 10.1 — Config Schema", () => {
  it("parses defaults correctly", () => {
    const result = ConfigSchema.parse({});
    expect(result.model).toBe("anthropic:claude-sonnet-4-6");
    expect(result.permissionMode).toBe("ask");
    expect(result.theme).toBe("dark");
    expect(result.maxTokens).toBe(8192);
    expect(result.temperature).toBe(0);
  });

  it("accepts valid config", () => {
    const result = ConfigSchema.parse({
      model: "openai:gpt-4o",
      permissionMode: "auto",
      theme: "light",
      maxTokens: 4096,
      temperature: 0.5,
      shell: "/bin/zsh",
      customInstructions: "Be concise.",
      memory: { enabled: true, autoSave: false },
      costLimit: { perSession: 10, perMonth: 100 },
    });
    expect(result.model).toBe("openai:gpt-4o");
    expect(result.permissionMode).toBe("auto");
    expect(result.theme).toBe("light");
    expect(result.memory?.autoSave).toBe(false);
    expect(result.costLimit?.perSession).toBe(10);
  });

  it("rejects invalid permissionMode", () => {
    const result = ConfigSchema.safeParse({ permissionMode: "yolo" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid theme", () => {
    const result = ConfigSchema.safeParse({ theme: "neon" });
    expect(result.success).toBe(false);
  });

  it("CONFIG_DEFAULTS matches schema defaults", () => {
    expect(CONFIG_DEFAULTS.model).toBe("anthropic:claude-sonnet-4-6");
    expect(CONFIG_DEFAULTS.permissionMode).toBe("ask");
  });
});

describe("Phase 10.1 — Config Loader", () => {
  let tmpDir: string;
  const origEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "curio-config-test-"));
    origEnv.CURIO_CODE_HOME = process.env.CURIO_CODE_HOME;
    origEnv.CURIO_CODE_CONFIG = process.env.CURIO_CODE_CONFIG;
    origEnv.CURIO_CODE_MODEL = process.env.CURIO_CODE_MODEL;
    origEnv.CURIO_CODE_PROVIDER = process.env.CURIO_CODE_PROVIDER;
    origEnv.CURIO_CODE_PERMISSION_MODE = process.env.CURIO_CODE_PERMISSION_MODE;
    origEnv.CURIO_CODE_NO_MEMORY = process.env.CURIO_CODE_NO_MEMORY;
    origEnv.CURIO_CODE_THEME = process.env.CURIO_CODE_THEME;
    delete process.env.CURIO_CODE_MODEL;
    delete process.env.CURIO_CODE_PROVIDER;
    delete process.env.CURIO_CODE_PERMISSION_MODE;
    delete process.env.CURIO_CODE_NO_MEMORY;
    delete process.env.CURIO_CODE_THEME;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    for (const [key, val] of Object.entries(origEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it("getCurioHome respects CURIO_CODE_HOME", () => {
    process.env.CURIO_CODE_HOME = "/custom/home";
    expect(getCurioHome()).toBe("/custom/home");
    delete process.env.CURIO_CODE_HOME;
    expect(getCurioHome()).toContain(".curio-code");
  });

  it("getConfigPaths returns global and project paths", () => {
    delete process.env.CURIO_CODE_CONFIG;
    const paths = getConfigPaths("/my/project");
    expect(paths.global).toContain(".curio-code/config.json");
    expect(paths.project).toBe("/my/project/.curio-code/config.json");
  });

  it("getConfigPaths respects CURIO_CODE_CONFIG", () => {
    process.env.CURIO_CODE_CONFIG = "/custom/config.json";
    const paths = getConfigPaths("/my/project");
    expect(paths.global).toBe("/custom/config.json");
    delete process.env.CURIO_CODE_CONFIG;
  });

  it("returns defaults when no config files exist", () => {
    const loaded = loadConfig({ projectRoot: tmpDir });
    expect(loaded.config.model).toBe("anthropic:claude-sonnet-4-6");
    expect(loaded.globalExists).toBe(false);
    expect(loaded.projectExists).toBe(false);
    expect(loaded.errors).toHaveLength(0);
  });

  it("loads project config file", async () => {
    const configDir = path.join(tmpDir, ".curio-code");
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, "config.json"),
      JSON.stringify({ model: "openai:gpt-4o", theme: "light" }),
    );

    const loaded = loadConfig({ projectRoot: tmpDir });
    expect(loaded.config.model).toBe("openai:gpt-4o");
    expect(loaded.config.theme).toBe("light");
    expect(loaded.projectExists).toBe(true);
  });

  it("env vars override config files", async () => {
    const configDir = path.join(tmpDir, ".curio-code");
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, "config.json"),
      JSON.stringify({ model: "openai:gpt-4o" }),
    );

    process.env.CURIO_CODE_MODEL = "groq:llama-3.1-70b-versatile";
    const loaded = loadConfig({ projectRoot: tmpDir });
    expect(loaded.config.model).toBe("groq:llama-3.1-70b-versatile");
  });

  it("CLI overrides take highest priority", async () => {
    process.env.CURIO_CODE_MODEL = "groq:llama-3.1-70b-versatile";
    const loaded = loadConfig({
      projectRoot: tmpDir,
      cliOverrides: { model: "anthropic:claude-opus-4-6" },
    });
    expect(loaded.config.model).toBe("anthropic:claude-opus-4-6");
  });

  it("CURIO_CODE_NO_MEMORY disables memory", () => {
    process.env.CURIO_CODE_NO_MEMORY = "1";
    const loaded = loadConfig({ projectRoot: tmpDir });
    expect(loaded.config.memory?.enabled).toBe(false);
  });

  it("reports validation errors gracefully", async () => {
    const configDir = path.join(tmpDir, ".curio-code");
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, "config.json"),
      JSON.stringify({ permissionMode: "yolo" }),
    );

    const loaded = loadConfig({ projectRoot: tmpDir });
    expect(loaded.errors.length).toBeGreaterThan(0);
  });
});

describe("Phase 10.1 — getConfigValue", () => {
  it("reads top-level key", () => {
    expect(getConfigValue(CONFIG_DEFAULTS, "model")).toBe("anthropic:claude-sonnet-4-6");
  });

  it("reads nested key", () => {
    const config: CurioConfig = { ...CONFIG_DEFAULTS, memory: { enabled: true, autoSave: false } };
    expect(getConfigValue(config, "memory.autoSave")).toBe(false);
  });

  it("returns undefined for missing key", () => {
    expect(getConfigValue(CONFIG_DEFAULTS, "nonexistent.key")).toBeUndefined();
  });
});

describe("Phase 10.1 — initProjectConfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "curio-init-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates .curio-code/config.json", () => {
    const result = initProjectConfig(tmpDir);
    expect(result).toContain("Created");

    const configPath = path.join(tmpDir, ".curio-code", "config.json");
    const raw = fsSync.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.model).toBe("anthropic:claude-sonnet-4-6");
    expect(parsed.permissionMode).toBe("ask");
  });

  it("does not overwrite existing config", () => {
    initProjectConfig(tmpDir);
    const result = initProjectConfig(tmpDir);
    expect(result).toContain("already exists");
  });
});

describe("Phase 10.1 — setConfigValue", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "curio-setcfg-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates file and sets top-level key", () => {
    const filePath = path.join(tmpDir, "config.json");
    setConfigValue(filePath, "model", "openai:gpt-4o");

    const raw = fsSync.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.model).toBe("openai:gpt-4o");
  });

  it("sets nested key", () => {
    const filePath = path.join(tmpDir, "config.json");
    setConfigValue(filePath, "memory.autoSave", false);

    const raw = fsSync.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.memory.autoSave).toBe(false);
  });

  it("preserves existing keys", () => {
    const filePath = path.join(tmpDir, "config.json");
    fsSync.writeFileSync(filePath, JSON.stringify({ model: "openai:gpt-4o" }));
    setConfigValue(filePath, "theme", "light");

    const raw = fsSync.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.model).toBe("openai:gpt-4o");
    expect(parsed.theme).toBe("light");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10.3 Hooks System
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 10.3 — Hook System", () => {
  it("buildHookSystem creates registry with built-in hooks", () => {
    const { registry, costTracker } = buildHookSystem();
    expect(registry.hasHandlers("tool.call.after")).toBe(true);
    expect(registry.hasHandlers("agent.run.after")).toBe(true);
    expect(registry.hasHandlers("tool.call.before")).toBe(true);
    expect(costTracker.turns).toHaveLength(0);
    expect(costTracker.totalCost).toBe(0);
  });

  it("registers user hooks from config", () => {
    const { registry } = buildHookSystem({
      "tool.call.after:file_write": "echo formatted",
    });
    expect(registry.handlerCount("tool.call.after:file_write")).toBe(1);
  });

  it("formatCostSummary handles empty tracker", () => {
    const tracker: CostTracker = { turns: [], totalCost: 0 };
    const result = formatCostSummary(tracker);
    expect(result).toContain("No cost data");
  });

  it("formatCostSummary formats cost data", () => {
    const tracker: CostTracker = {
      turns: [
        { model: "anthropic:claude-sonnet-4-6", promptTokens: 1000, completionTokens: 500, estimatedCost: 0.01 },
        { model: "anthropic:claude-sonnet-4-6", promptTokens: 2000, completionTokens: 1000, estimatedCost: 0.02 },
      ],
      totalCost: 0.03,
    };
    const result = formatCostSummary(tracker);
    expect(result).toContain("anthropic:claude-sonnet-4-6");
    expect(result).toContain("Turns: 2");
    expect(result).toContain("Total estimated cost");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10.5 Slash Commands — new commands
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 10.5 — Slash Commands", () => {
  const baseCtx: SlashCommandContext = {
    currentModel: "anthropic:claude-sonnet-4-6",
    currentProvider: "anthropic",
    permissionMode: "ask",
  };

  describe("isSlashCommand", () => {
    it("detects commands starting with /", () => {
      expect(isSlashCommand("/help")).toBe(true);
      expect(isSlashCommand("/model list")).toBe(true);
      expect(isSlashCommand("hello")).toBe(false);
    });
  });

  describe("/help", () => {
    it("shows help text", async () => {
      const result = await handleSlashCommand("/help", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("Available commands");
      expect(result.output).toContain("/model");
      expect(result.output).toContain("/config");
      expect(result.output).toContain("/skills");
      expect(result.output).toContain("/status");
      expect(result.output).toContain("/cost");
      expect(result.output).toContain("/mode");
      expect(result.output).toContain("/version");
      expect(result.output).toContain("/bug");
      expect(result.output).toContain("Keybindings");
      expect(result.output).toContain("Escape");
    });

    it("shows per-command help", async () => {
      const result = await handleSlashCommand("/help model", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("Usage:");
    });

    it("error on unknown command help", async () => {
      const result = await handleSlashCommand("/help nonexistent", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.error).toContain("No help for");
    });
  });

  describe("/version", () => {
    it("shows version", async () => {
      const result = await handleSlashCommand("/version", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("Curio Code v");
    });
  });

  describe("/bug", () => {
    it("shows bug report link", async () => {
      const result = await handleSlashCommand("/bug", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("github.com");
    });
  });

  describe("/status", () => {
    it("shows status info", async () => {
      const result = await handleSlashCommand("/status", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("anthropic:claude-sonnet-4-6");
      expect(result.output).toContain("Anthropic");
      expect(result.output).toContain("ask");
    });
  });

  describe("/cost", () => {
    it("shows no data when no tracker", async () => {
      const result = await handleSlashCommand("/cost", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("not available");
    });

    it("shows cost data from tracker", async () => {
      const ctx: SlashCommandContext = {
        ...baseCtx,
        costTracker: {
          turns: [{ model: "test", promptTokens: 100, completionTokens: 50, estimatedCost: 0.001 }],
          totalCost: 0.001,
        },
      };
      const result = await handleSlashCommand("/cost", ctx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("test");
      expect(result.output).toContain("Total estimated cost");
    });
  });

  describe("/mode", () => {
    it("shows current mode", async () => {
      const result = await handleSlashCommand("/mode", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("ask");
    });

    it("changes mode", async () => {
      let changed: string | undefined;
      const ctx: SlashCommandContext = {
        ...baseCtx,
        onPermissionModeChange: (m) => { changed = m; },
      };
      const result = await handleSlashCommand("/mode auto", ctx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("auto");
      expect(changed).toBe("auto");
    });

    it("rejects invalid mode", async () => {
      const result = await handleSlashCommand("/mode yolo", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.error).toContain("Invalid mode");
    });
  });

  describe("/config", () => {
    it("shows full config", async () => {
      const result = await handleSlashCommand("/config", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("model");
    });

    it("shows specific key", async () => {
      const result = await handleSlashCommand("/config model", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("model:");
    });
  });

  describe("/skills", () => {
    it("reports no skills when registry missing", async () => {
      const result = await handleSlashCommand("/skills", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("No skills");
    });
  });

  describe("/exit and /quit", () => {
    it("/exit calls onExit", async () => {
      let exited = false;
      const ctx: SlashCommandContext = { ...baseCtx, onExit: () => { exited = true; } };
      const result = await handleSlashCommand("/exit", ctx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("Goodbye");
      expect(exited).toBe(true);
    });

    it("/quit calls onExit", async () => {
      let exited = false;
      const ctx: SlashCommandContext = { ...baseCtx, onExit: () => { exited = true; } };
      const result = await handleSlashCommand("/quit", ctx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("Goodbye");
      expect(exited).toBe(true);
    });
  });

  describe("/export", () => {
    it("errors when no session", async () => {
      const result = await handleSlashCommand("/export", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.error).toContain("No active session");
    });
  });

  describe("getSlashCommandCompletions", () => {
    it("completes /h to /help", () => {
      const completions = getSlashCommandCompletions("/h");
      expect(completions).toContain("/help");
    });

    it("completes /mo to /model and /mode", () => {
      const completions = getSlashCommandCompletions("/mo");
      expect(completions).toContain("/model");
      expect(completions).toContain("/mode");
    });

    it("returns all commands for /", () => {
      const completions = getSlashCommandCompletions("/");
      expect(completions.length).toBeGreaterThan(10);
    });

    it("returns empty for non-slash input", () => {
      expect(getSlashCommandCompletions("hello")).toEqual([]);
    });
  });

  describe("unknown commands", () => {
    it("returns error for unknown command", async () => {
      const result = await handleSlashCommand("/foobar", baseCtx);
      expect(result.handled).toBe(false);
      expect(result.error).toContain("Unknown command");
    });
  });

  describe("existing commands still work", () => {
    it("/clear returns __CLEAR__", async () => {
      const result = await handleSlashCommand("/clear", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toBe("__CLEAR__");
    });

    it("/model shows current model", async () => {
      const result = await handleSlashCommand("/model", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("anthropic:claude-sonnet-4-6");
    });

    it("/model list shows available models", async () => {
      const result = await handleSlashCommand("/model list", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.output).toContain("Available models");
    });

    it("/memory without memoryFile errors", async () => {
      const result = await handleSlashCommand("/memory", baseCtx);
      expect(result.handled).toBe(true);
      expect(result.error).toContain("not available");
    });
  });
});

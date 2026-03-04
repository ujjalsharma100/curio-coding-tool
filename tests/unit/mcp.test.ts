import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// ── 9.3 MCP Config Loading ──────────────────────────────────────────────

import {
  loadMergedMcpConfig,
  getMcpConfigPaths,
  addMcpServerToConfig,
  removeMcpServerFromConfig,
} from "../../src/mcp/config.js";

import { McpBridgeManager } from "../../src/mcp/bridge-manager.js";

import {
  handleSlashCommand,
  type SlashCommandContext,
} from "../../src/cli/commands/slash-commands.js";

describe("Phase 9.3 — MCP Configuration", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "curio-mcp-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("getMcpConfigPaths", () => {
    it("returns global and project paths", () => {
      const paths = getMcpConfigPaths("/my/project");
      expect(paths.global).toContain(".curio-code/mcp.json");
      expect(paths.project).toBe("/my/project/.curio-code/mcp.json");
    });
  });

  describe("loadMergedMcpConfig", () => {
    it("returns empty array when no config files exist", async () => {
      const configs = await loadMergedMcpConfig(tmpDir);
      expect(configs).toEqual([]);
    });

    it("loads project-level config", async () => {
      const configDir = path.join(tmpDir, ".curio-code");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            testServer: {
              command: "node",
              args: ["server.js"],
            },
          },
        }),
      );

      const configs = await loadMergedMcpConfig(tmpDir);
      expect(configs).toHaveLength(1);
      expect(configs[0]!.name).toBe("testServer");
      expect(configs[0]!.transport).toMatchObject({
        type: "stdio",
        command: "node",
        args: ["server.js"],
      });
    });

    it("supports HTTP/SSE server config", async () => {
      const configDir = path.join(tmpDir, ".curio-code");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            remoteServer: {
              type: "sse",
              url: "https://mcp.example.com/sse",
            },
          },
        }),
      );

      const configs = await loadMergedMcpConfig(tmpDir);
      expect(configs).toHaveLength(1);
      expect(configs[0]!.name).toBe("remoteServer");
    });

    it("merges multiple servers from config", async () => {
      const configDir = path.join(tmpDir, ".curio-code");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            filesystem: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
            },
            github: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-github"],
              env: { GITHUB_TOKEN: "test-token" },
            },
          },
        }),
      );

      const configs = await loadMergedMcpConfig(tmpDir);
      expect(configs).toHaveLength(2);
      const names = configs.map((c) => c.name);
      expect(names).toContain("filesystem");
      expect(names).toContain("github");
    });
  });

  describe("addMcpServerToConfig", () => {
    it("creates config file and adds server", async () => {
      await addMcpServerToConfig("test", "node", ["server.js"], tmpDir);

      const configPath = path.join(tmpDir, ".curio-code", "mcp.json");
      const raw = JSON.parse(await fs.readFile(configPath, "utf8"));
      expect(raw.mcpServers.test).toEqual({
        command: "node",
        args: ["server.js"],
      });
    });

    it("adds to existing config without overwriting other servers", async () => {
      const configDir = path.join(tmpDir, ".curio-code");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            existing: { command: "python", args: ["server.py"] },
          },
        }),
      );

      await addMcpServerToConfig("newServer", "node", ["s.js"], tmpDir);

      const raw = JSON.parse(
        await fs.readFile(path.join(configDir, "mcp.json"), "utf8"),
      );
      expect(raw.mcpServers.existing).toBeDefined();
      expect(raw.mcpServers.newServer).toBeDefined();
    });
  });

  describe("removeMcpServerFromConfig", () => {
    it("removes a server from config", async () => {
      const configDir = path.join(tmpDir, ".curio-code");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            toRemove: { command: "node", args: [] },
            toKeep: { command: "python", args: [] },
          },
        }),
      );

      const removed = await removeMcpServerFromConfig("toRemove", tmpDir);
      expect(removed).toBe(true);

      const raw = JSON.parse(
        await fs.readFile(path.join(configDir, "mcp.json"), "utf8"),
      );
      expect(raw.mcpServers.toRemove).toBeUndefined();
      expect(raw.mcpServers.toKeep).toBeDefined();
    });

    it("returns false when server not found", async () => {
      const removed = await removeMcpServerFromConfig("nonexistent", tmpDir);
      expect(removed).toBe(false);
    });
  });
});

// ── 9.1 MCP Bridge Manager ────────────────────────────────────────────

describe("Phase 9.1 — McpBridgeManager", () => {
  it("reports hasServers false when no configs", () => {
    const mgr = new McpBridgeManager([]);
    expect(mgr.hasServers).toBe(false);
  });

  it("reports hasServers true when configs present", () => {
    const mgr = new McpBridgeManager([
      { name: "test", transport: { type: "stdio", command: "echo" } },
    ]);
    expect(mgr.hasServers).toBe(true);
  });

  it("getTools returns empty array when not started", async () => {
    const mgr = new McpBridgeManager([]);
    const tools = await mgr.getTools();
    expect(tools).toEqual([]);
  });

  it("getStatus returns empty array when no servers", async () => {
    const mgr = new McpBridgeManager([]);
    const statuses = await mgr.getStatus();
    expect(statuses).toEqual([]);
  });

  it("listResources returns empty array when not started", async () => {
    const mgr = new McpBridgeManager([]);
    const resources = await mgr.listResources();
    expect(resources).toEqual([]);
  });

  it("listPrompts returns empty array when not started", async () => {
    const mgr = new McpBridgeManager([]);
    const prompts = await mgr.listPrompts();
    expect(prompts).toEqual([]);
  });

  it("readResource returns null when not started", async () => {
    const mgr = new McpBridgeManager([]);
    const result = await mgr.readResource("file:///test");
    expect(result).toBeNull();
  });

  it("getPrompt returns null when not started", async () => {
    const mgr = new McpBridgeManager([]);
    const result = await mgr.getPrompt("server", "prompt");
    expect(result).toBeNull();
  });

  it("getClient returns undefined when not started", () => {
    const mgr = new McpBridgeManager([
      { name: "test", transport: { type: "stdio", command: "echo" } },
    ]);
    expect(mgr.getClient("test")).toBeUndefined();
  });

  it("shutdown is safe when not started", async () => {
    const mgr = new McpBridgeManager([]);
    await expect(mgr.shutdown()).resolves.toBeUndefined();
  });

  it("startup is no-op when no servers", async () => {
    const mgr = new McpBridgeManager([]);
    await expect(mgr.startup()).resolves.toBeUndefined();
    expect(mgr.hasServers).toBe(false);
  });
});

// ── 9.3.3 MCP Slash Commands ──────────────────────────────────────────

describe("Phase 9.3.3 — /mcp slash commands", () => {
  const baseCtx: SlashCommandContext = {};

  it("/mcp with no bridge shows no servers message", async () => {
    const result = await handleSlashCommand("/mcp", baseCtx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain("No MCP servers configured");
  });

  it("/mcp list with no bridge shows no servers message", async () => {
    const result = await handleSlashCommand("/mcp list", baseCtx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain("No MCP servers configured");
  });

  it("/mcp with bridge shows server list", async () => {
    const bridge = new McpBridgeManager([
      { name: "testServer", transport: { type: "stdio", command: "echo" } },
    ]);

    const ctx: SlashCommandContext = { mcpBridgeManager: bridge };
    const result = await handleSlashCommand("/mcp", ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain("MCP Servers:");
    expect(result.output).toContain("testServer");
  });

  it("/mcp add without args shows usage", async () => {
    const result = await handleSlashCommand("/mcp add", baseCtx);
    expect(result.handled).toBe(true);
    expect(result.error).toContain("Usage");
  });

  it("/mcp remove without args shows usage", async () => {
    const result = await handleSlashCommand("/mcp remove", baseCtx);
    expect(result.handled).toBe(true);
    expect(result.error).toContain("Usage");
  });

  it("/mcp restart without bridge shows error", async () => {
    const result = await handleSlashCommand("/mcp restart test", baseCtx);
    expect(result.handled).toBe(true);
    expect(result.error).toContain("No MCP bridge available");
  });

  it("/mcp restart with unknown server shows error", async () => {
    const bridge = new McpBridgeManager([]);
    const ctx: SlashCommandContext = { mcpBridgeManager: bridge };
    const result = await handleSlashCommand("/mcp restart unknown", ctx);
    expect(result.handled).toBe(true);
    expect(result.error).toContain("not found");
  });

  it("/mcp unknown subcommand shows error", async () => {
    const result = await handleSlashCommand("/mcp badcmd", baseCtx);
    expect(result.handled).toBe(true);
    expect(result.error).toContain("Unknown /mcp subcommand");
  });

  it("/help includes /mcp commands", async () => {
    const result = await handleSlashCommand("/help", baseCtx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain("/mcp");
  });
});

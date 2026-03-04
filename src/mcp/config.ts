/**
 * MCP configuration loading and merging.
 *
 * Supports project-level `.curio-code/mcp.json` and global `~/.curio-code/mcp.json`.
 * Project config overrides global config (server-name level merge).
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadMcpConfig as sdkLoadMcpConfig,
  parseMcpConfig as sdkParseMcpConfig,
} from "curio-agent-sdk";
import type { MCPServerConfig } from "curio-agent-sdk";

export interface McpConfigPaths {
  global: string;
  project: string;
}

const CURIO_HOME = path.join(os.homedir(), ".curio-code");

export function getMcpConfigPaths(projectRoot?: string): McpConfigPaths {
  const cwd = projectRoot ?? process.cwd();
  return {
    global: path.join(CURIO_HOME, "mcp.json"),
    project: path.join(cwd, ".curio-code", "mcp.json"),
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadConfigFile(filePath: string): Promise<MCPServerConfig[]> {
  if (!(await fileExists(filePath))) return [];
  try {
    return await sdkLoadMcpConfig(filePath);
  } catch {
    return [];
  }
}

/**
 * Load and merge MCP server configurations from global and project config files.
 * Project-level servers override global servers with the same name.
 */
export async function loadMergedMcpConfig(
  projectRoot?: string,
): Promise<MCPServerConfig[]> {
  const paths = getMcpConfigPaths(projectRoot);
  const globalServers = await loadConfigFile(paths.global);
  const projectServers = await loadConfigFile(paths.project);

  const merged = new Map<string, MCPServerConfig>();
  for (const s of globalServers) merged.set(s.name, s);
  for (const s of projectServers) merged.set(s.name, s);

  return Array.from(merged.values());
}

/**
 * Add a server entry to the project-level MCP config file.
 */
export async function addMcpServerToConfig(
  name: string,
  command: string,
  args: string[],
  projectRoot?: string,
): Promise<void> {
  const paths = getMcpConfigPaths(projectRoot);
  const configPath = paths.project;

  let existing: Record<string, unknown> = {};
  try {
    const text = await fs.readFile(configPath, "utf8");
    existing = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // file doesn't exist or is invalid
  }

  const mcpServers = (existing["mcpServers"] ?? {}) as Record<string, unknown>;
  mcpServers[name] = { command, args };
  existing["mcpServers"] = mcpServers;

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(existing, null, 2) + "\n");
}

/**
 * Remove a server entry from the project-level MCP config file.
 */
export async function removeMcpServerFromConfig(
  name: string,
  projectRoot?: string,
): Promise<boolean> {
  const paths = getMcpConfigPaths(projectRoot);
  const configPath = paths.project;

  try {
    const text = await fs.readFile(configPath, "utf8");
    const existing = JSON.parse(text) as Record<string, unknown>;
    const mcpServers = (existing["mcpServers"] ?? {}) as Record<string, unknown>;

    if (!(name in mcpServers)) return false;

    delete mcpServers[name];
    existing["mcpServers"] = mcpServers;
    await fs.writeFile(configPath, JSON.stringify(existing, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

export { sdkParseMcpConfig as parseMcpConfig };
export type { MCPServerConfig };

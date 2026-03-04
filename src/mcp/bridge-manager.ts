/**
 * MCP bridge manager — lifecycle management for MCP server connections.
 *
 * Wraps the SDK's MCPBridge to add:
 * - Graceful startup with per-server error handling (one failing server doesn't block others)
 * - Server restart support
 * - Resource and prompt access
 * - Status reporting for /mcp slash commands
 */

import { MCPBridge } from "curio-agent-sdk";
import type { MCPClient, MCPServerConfig } from "curio-agent-sdk";
import type { Tool } from "curio-agent-sdk";

export interface McpServerStatus {
  name: string;
  connected: boolean;
  toolCount: number;
  tools: string[];
  error?: string;
}

export class McpBridgeManager {
  private bridge: MCPBridge | null = null;
  private serverConfigs: MCPServerConfig[];
  private serverErrors = new Map<string, string>();
  private started = false;

  constructor(servers: MCPServerConfig[]) {
    this.serverConfigs = servers;
  }

  get hasServers(): boolean {
    return this.serverConfigs.length > 0;
  }

  /**
   * Connect to all configured MCP servers.
   * Individual server failures are captured but don't prevent other servers from connecting.
   */
  async startup(): Promise<void> {
    if (this.started || this.serverConfigs.length === 0) return;

    this.bridge = new MCPBridge({
      servers: this.serverConfigs,
      clientName: "curio-code",
      clientVersion: "0.0.0",
    });

    try {
      await this.bridge.startup();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const s of this.serverConfigs) {
        this.serverErrors.set(s.name, msg);
      }
    }

    this.started = true;
  }

  /** Disconnect from all MCP servers. */
  async shutdown(): Promise<void> {
    if (!this.started || !this.bridge) return;
    try {
      await this.bridge.shutdown();
    } catch {
      // Best-effort shutdown
    }
    this.bridge = null;
    this.started = false;
    this.serverErrors.clear();
  }

  /** Restart a specific MCP server by name. */
  async restartServer(name: string): Promise<boolean> {
    if (!this.bridge) return false;

    const config = this.serverConfigs.find((s) => s.name === name);
    if (!config) return false;

    await this.shutdown();

    this.bridge = new MCPBridge({
      servers: this.serverConfigs,
      clientName: "curio-code",
      clientVersion: "0.0.0",
    });

    try {
      await this.bridge.startup();
      this.serverErrors.delete(name);
    } catch (err) {
      this.serverErrors.set(name, err instanceof Error ? err.message : String(err));
    }

    this.started = true;
    return true;
  }

  /** Get all MCP tools converted to Curio tools. */
  async getTools(): Promise<Tool[]> {
    if (!this.bridge || !this.started) return [];
    try {
      return await this.bridge.getTools();
    } catch {
      return [];
    }
  }

  /** Get the MCPClient for a specific server. */
  getClient(serverName: string): MCPClient | undefined {
    return this.bridge?.getClient(serverName);
  }

  /** Get status of all configured MCP servers. */
  async getStatus(): Promise<McpServerStatus[]> {
    const statuses: McpServerStatus[] = [];

    for (const config of this.serverConfigs) {
      const error = this.serverErrors.get(config.name);
      if (error) {
        statuses.push({
          name: config.name,
          connected: false,
          toolCount: 0,
          tools: [],
          error,
        });
        continue;
      }

      const client = this.bridge?.getClient(config.name);
      if (!client?.connected) {
        statuses.push({
          name: config.name,
          connected: false,
          toolCount: 0,
          tools: [],
        });
        continue;
      }

      try {
        const tools = await client.listTools();
        statuses.push({
          name: config.name,
          connected: true,
          toolCount: tools.length,
          tools: tools.map((t) => t.name),
        });
      } catch {
        statuses.push({
          name: config.name,
          connected: true,
          toolCount: 0,
          tools: [],
        });
      }
    }

    return statuses;
  }

  /** List resources from a specific server, or all servers. */
  async listResources(serverName?: string): Promise<Array<{ server: string; uri: string; name: string | null; description: string | null }>> {
    if (!this.bridge || !this.started) return [];

    const results: Array<{ server: string; uri: string; name: string | null; description: string | null }> = [];
    const servers = serverName
      ? this.serverConfigs.filter((s) => s.name === serverName)
      : this.serverConfigs;

    for (const config of servers) {
      const client = this.bridge.getClient(config.name);
      if (!client?.connected) continue;

      try {
        const resources = await client.listResources();
        for (const r of resources) {
          results.push({
            server: config.name,
            uri: r.uri,
            name: r.name ?? null,
            description: r.description ?? null,
          });
        }
      } catch {
        // Server doesn't support resources
      }
    }

    return results;
  }

  /** Read a resource by URI from the first server that exposes it. */
  async readResource(uri: string, serverName?: string): Promise<{ contents: unknown; mimeType: string | null } | null> {
    if (!this.bridge || !this.started) return null;

    const servers = serverName
      ? this.serverConfigs.filter((s) => s.name === serverName)
      : this.serverConfigs;

    for (const config of servers) {
      const client = this.bridge.getClient(config.name);
      if (!client?.connected) continue;

      try {
        const result = await client.readResource(uri);
        return { contents: result.contents, mimeType: result.mimeType ?? null };
      } catch {
        continue;
      }
    }

    return null;
  }

  /** List prompts from all connected servers. */
  async listPrompts(): Promise<Array<{ server: string; name: string; description: string | null }>> {
    if (!this.bridge || !this.started) return [];

    const results: Array<{ server: string; name: string; description: string | null }> = [];

    for (const config of this.serverConfigs) {
      const client = this.bridge.getClient(config.name);
      if (!client?.connected) continue;

      try {
        const prompts = await client.listPrompts();
        for (const p of prompts) {
          results.push({
            server: config.name,
            name: p.name,
            description: p.description ?? null,
          });
        }
      } catch {
        // Server doesn't support prompts
      }
    }

    return results;
  }

  /** Get a prompt from a specific server. */
  async getPrompt(serverName: string, promptName: string, args?: Record<string, unknown>): Promise<unknown> {
    if (!this.bridge || !this.started) return null;

    const client = this.bridge.getClient(serverName);
    if (!client?.connected) return null;

    try {
      return await client.getPrompt(promptName, args);
    } catch {
      return null;
    }
  }
}

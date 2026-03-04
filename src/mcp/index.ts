export {
  loadMergedMcpConfig,
  getMcpConfigPaths,
  addMcpServerToConfig,
  removeMcpServerFromConfig,
  parseMcpConfig,
} from "./config.js";
export type { McpConfigPaths, MCPServerConfig } from "./config.js";

export { McpBridgeManager } from "./bridge-manager.js";
export type { McpServerStatus } from "./bridge-manager.js";

import { NetworkSandboxPolicy, type PermissionPolicy } from "curio-agent-sdk";

export interface NetworkSecurityConfig {
  enabled: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

/**
 * Build an optional network sandbox policy. By default, all outbound network
 * access is allowed (needed for LLM API calls, web fetch, web search). When
 * `enabled` is true, traffic is restricted to `allowedDomains` only.
 */
export function buildNetworkPolicy(
  config: NetworkSecurityConfig,
): PermissionPolicy | null {
  if (!config.enabled) return null;

  const patterns = config.allowedDomains ?? [];
  if (patterns.length === 0) return null;

  return new NetworkSandboxPolicy(patterns);
}

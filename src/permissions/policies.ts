import {
  CompoundPolicy,
  type PermissionPolicy,
  type PermissionResult,
} from "curio-agent-sdk";
import { type PermissionMode, basePolicyForMode } from "./modes.js";
import { buildFileSandboxPolicy, isBlockedPath, isSensitivePath } from "./allowlist.js";
import { type BashClassifierConfig, classifyCommand } from "./bash-classifier.js";
import { type NetworkSecurityConfig, buildNetworkPolicy } from "./network.js";

/* ── Bash safety policy ──────────────────────────────────────────── */

/**
 * Custom policy that integrates bash command risk classification into
 * the SDK permission pipeline. Dangerous commands always require
 * confirmation. Safe commands in "ask" mode are auto-allowed.
 */
class BashSafetyPolicy implements PermissionPolicy {
  private readonly mode: PermissionMode;
  private readonly classifierConfig?: BashClassifierConfig;
  private readonly sessionAllowed = new Set<string>();

  constructor(mode: PermissionMode, classifierConfig?: BashClassifierConfig) {
    this.mode = mode;
    this.classifierConfig = classifierConfig;
  }

  async checkToolCall(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<PermissionResult> {
    if (toolName !== "bash") {
      return { allowed: true };
    }

    const command = typeof args.command === "string" ? args.command : "";
    const risk = classifyCommand(command, this.classifierConfig);

    if (risk === "dangerous") {
      return {
        allowed: true,
        requireConfirmation: true,
        reason: `Dangerous command detected: ${command}`,
      };
    }

    if (this.mode === "auto") {
      return { allowed: true };
    }

    if (risk === "safe" && this.mode === "ask") {
      return { allowed: true };
    }

    if (risk === "moderate" && this.sessionAllowed.has(command)) {
      return { allowed: true };
    }

    if (risk === "moderate") {
      return {
        allowed: true,
        requireConfirmation: true,
        reason: `Command requires confirmation: ${command}`,
      };
    }

    return { allowed: true, requireConfirmation: true };
  }

  /** Mark a command (or its tool) as allowed for the rest of the session. */
  allowForSession(command: string): void {
    this.sessionAllowed.add(command);
  }
}

/* ── Blocked-path guard ──────────────────────────────────────────── */

/**
 * Lightweight policy that unconditionally denies access to blocked paths
 * (SSH keys, AWS credentials, /etc/shadow, etc.) and flags sensitive
 * files (*.env, *.pem) for confirmation.
 */
class PathGuardPolicy implements PermissionPolicy {
  async checkToolCall(
    _toolName: string,
    args: Record<string, unknown>,
  ): Promise<PermissionResult> {
    const paths = this.extractPaths(args);

    for (const p of paths) {
      if (isBlockedPath(p)) {
        return {
          allowed: false,
          reason: `Access to ${p} is blocked for security.`,
        };
      }
      if (isSensitivePath(p)) {
        return {
          allowed: true,
          requireConfirmation: true,
          reason: `Accessing sensitive file: ${p}`,
        };
      }
    }

    return { allowed: true };
  }

  private extractPaths(args: Record<string, unknown>): string[] {
    const result: string[] = [];
    const pathKeys = [
      "file_path", "path", "filepath", "file", "target",
      "directory", "dir", "old_file_path", "new_file_path",
    ];
    for (const key of pathKeys) {
      const val = args[key];
      if (typeof val === "string") result.push(val);
    }
    const arrayKeys = ["file_paths", "paths"];
    for (const key of arrayKeys) {
      const val = args[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === "string") result.push(item);
        }
      }
    }
    return result;
  }
}

/* ── Public API ───────────────────────────────────────────────────── */

export interface PermissionSystemConfig {
  mode: PermissionMode;
  projectRoot: string;
  additionalAllowedPaths?: string[];
  bashClassifier?: BashClassifierConfig;
  network?: NetworkSecurityConfig;
}

export interface PermissionSystem {
  policy: PermissionPolicy;
  bashSafety: BashSafetyPolicy;
}

/**
 * Assemble the full compound permission policy from individual layers:
 * 1. Path guard (blocked / sensitive files)
 * 2. File sandbox (project root + allowed prefixes)
 * 3. Mode-based SDK policy (ask / auto / strict)
 * 4. Bash command safety classifier
 * 5. Optional network sandbox
 */
export function buildPermissionSystem(config: PermissionSystemConfig): PermissionSystem {
  const pathGuard = new PathGuardPolicy();
  const fileSandbox = buildFileSandboxPolicy({
    projectRoot: config.projectRoot,
    additionalAllowed: config.additionalAllowedPaths,
  });
  const modePolicy = basePolicyForMode(config.mode);
  const bashSafety = new BashSafetyPolicy(config.mode, config.bashClassifier);

  const policies: PermissionPolicy[] = [
    pathGuard,
    fileSandbox,
    modePolicy,
    bashSafety,
  ];

  if (config.network) {
    const netPolicy = buildNetworkPolicy(config.network);
    if (netPolicy) policies.push(netPolicy);
  }

  return {
    policy: new CompoundPolicy(policies),
    bashSafety,
  };
}

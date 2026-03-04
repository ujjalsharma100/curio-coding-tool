import {
  AllowAll,
  AllowReadsAskWrites,
  AskAlways,
  type PermissionPolicy,
} from "curio-agent-sdk";

export type PermissionMode = "ask" | "auto" | "strict";

/**
 * Returns the base SDK permission policy for a given mode.
 *
 * - **ask** (default): read tools auto-allowed, write tools require confirmation.
 * - **auto**: all operations allowed without confirmation.
 * - **strict**: every tool call requires confirmation.
 */
export function basePolicyForMode(mode: PermissionMode): PermissionPolicy {
  switch (mode) {
    case "auto":
      return new AllowAll();
    case "strict":
      return new AskAlways();
    case "ask":
    default:
      return new AllowReadsAskWrites();
  }
}

export function permissionModeStartupWarning(mode: PermissionMode): string | null {
  if (mode === "auto") {
    return "Running in auto mode — all operations will be allowed without confirmation.";
  }
  return null;
}

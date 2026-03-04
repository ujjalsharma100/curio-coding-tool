import { homedir } from "node:os";
import { resolve } from "node:path";
import { FileSandboxPolicy, type PermissionPolicy } from "curio-agent-sdk";

const BLOCKED_PATHS = [
  "/etc/shadow",
  "/etc/passwd",
  "~/.ssh",
  "~/.aws/credentials",
  "~/.gnupg",
  "~/.config/gcloud/credentials",
  "~/.kube/config",
];

const SENSITIVE_EXTENSIONS = [".pem", ".key", ".p12", ".pfx", ".jks"];

const SENSITIVE_FILENAMES = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.staging",
  ".env.development",
  "credentials.json",
  "service-account.json",
  "secrets.json",
  "token.json",
];

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return resolve(homedir(), p.slice(2));
  }
  return p;
}

const expandedBlockedPaths = BLOCKED_PATHS.map(expandHome);

/**
 * Returns true if the given path is unconditionally blocked
 * (private keys, credentials, system password stores).
 */
export function isBlockedPath(filePath: string): boolean {
  const normalized = resolve(filePath);
  return expandedBlockedPaths.some(
    (blocked) =>
      normalized === blocked || normalized.startsWith(blocked + "/"),
  );
}

/**
 * Returns true if the file is sensitive (env files, certs, credential JSON).
 * These are not blocked but should trigger a warning.
 */
export function isSensitivePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const basename = lower.split("/").pop() ?? "";

  if (SENSITIVE_FILENAMES.some((s) => basename === s.toLowerCase())) return true;
  if (SENSITIVE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;

  return false;
}

export interface AllowlistConfig {
  projectRoot: string;
  additionalAllowed?: string[];
}

/**
 * Build an SDK `FileSandboxPolicy` restricting file access to the project root
 * and the curio-code config directory, plus any additional paths from config.
 */
export function buildFileSandboxPolicy(config: AllowlistConfig): PermissionPolicy {
  const home = homedir();
  const allowedPrefixes = [
    resolve(config.projectRoot),
    resolve(home, ".curio-code"),
    ...(config.additionalAllowed ?? []).map((p) => resolve(p)),
    "/tmp",
  ];

  return new FileSandboxPolicy(allowedPrefixes);
}

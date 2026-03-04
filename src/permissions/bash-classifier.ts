export type RiskLevel = "safe" | "moderate" | "dangerous";

interface ClassificationRule {
  pattern: RegExp;
  level: RiskLevel;
}

const DANGEROUS_PATTERNS: ClassificationRule[] = [
  { pattern: /\brm\s+-[^\s]*r[^\s]*f|rm\s+-[^\s]*f[^\s]*r/i, level: "dangerous" },
  { pattern: /\brm\s+-rf\s+\//i, level: "dangerous" },
  { pattern: /\bgit\s+push\s+.*--force\b/i, level: "dangerous" },
  { pattern: /\bgit\s+reset\s+--hard\b/i, level: "dangerous" },
  { pattern: /\bsudo\b/i, level: "dangerous" },
  { pattern: /\bchmod\b/i, level: "dangerous" },
  { pattern: /\bchown\b/i, level: "dangerous" },
  { pattern: /\bdd\b/i, level: "dangerous" },
  { pattern: /\bmkfs\b/i, level: "dangerous" },
  { pattern: /\bcurl\s+.*\|\s*(?:ba)?sh\b/i, level: "dangerous" },
  { pattern: /\bwget\s+.*\|\s*(?:ba)?sh\b/i, level: "dangerous" },
  { pattern: /\bkill\b/i, level: "dangerous" },
  { pattern: /\bpkill\b/i, level: "dangerous" },
  { pattern: /\bkillall\b/i, level: "dangerous" },
  { pattern: /\breboot\b/i, level: "dangerous" },
  { pattern: /\bshutdown\b/i, level: "dangerous" },
  { pattern: />\s*\/dev\/sd/i, level: "dangerous" },
  { pattern: /\bformat\b/i, level: "dangerous" },
];

const MODERATE_PATTERNS: ClassificationRule[] = [
  { pattern: /\bnpm\s+install\b/i, level: "moderate" },
  { pattern: /\bnpm\s+i\b/i, level: "moderate" },
  { pattern: /\bbun\s+add\b/i, level: "moderate" },
  { pattern: /\bbun\s+install\b/i, level: "moderate" },
  { pattern: /\byarn\s+add\b/i, level: "moderate" },
  { pattern: /\bpip\s+install\b/i, level: "moderate" },
  { pattern: /\bgit\s+commit\b/i, level: "moderate" },
  { pattern: /\bgit\s+add\b/i, level: "moderate" },
  { pattern: /\bgit\s+merge\b/i, level: "moderate" },
  { pattern: /\bgit\s+rebase\b/i, level: "moderate" },
  { pattern: /\bgit\s+checkout\b/i, level: "moderate" },
  { pattern: /\bgit\s+stash\b/i, level: "moderate" },
  { pattern: /\bmake\b/i, level: "moderate" },
  { pattern: /\bcargo\s+build\b/i, level: "moderate" },
  { pattern: /\bgo\s+build\b/i, level: "moderate" },
  { pattern: /\bnpm\s+run\s+build\b/i, level: "moderate" },
  { pattern: /\bdocker\s+build\b/i, level: "moderate" },
  { pattern: /\bdocker\s+run\b/i, level: "moderate" },
];

const SAFE_PATTERNS: ClassificationRule[] = [
  { pattern: /^\s*ls\b/i, level: "safe" },
  { pattern: /^\s*cat\b/i, level: "safe" },
  { pattern: /^\s*echo\b/i, level: "safe" },
  { pattern: /^\s*pwd\b/i, level: "safe" },
  { pattern: /^\s*head\b/i, level: "safe" },
  { pattern: /^\s*tail\b/i, level: "safe" },
  { pattern: /^\s*wc\b/i, level: "safe" },
  { pattern: /^\s*which\b/i, level: "safe" },
  { pattern: /^\s*whoami\b/i, level: "safe" },
  { pattern: /^\s*date\b/i, level: "safe" },
  { pattern: /^\s*uname\b/i, level: "safe" },
  { pattern: /^\s*env\b/i, level: "safe" },
  { pattern: /^\s*printenv\b/i, level: "safe" },
  { pattern: /\bgit\s+status\b/i, level: "safe" },
  { pattern: /\bgit\s+log\b/i, level: "safe" },
  { pattern: /\bgit\s+diff\b/i, level: "safe" },
  { pattern: /\bgit\s+branch\b/i, level: "safe" },
  { pattern: /\bgit\s+show\b/i, level: "safe" },
  { pattern: /\bgit\s+remote\s+-v\b/i, level: "safe" },
  { pattern: /\bnpm\s+test\b/i, level: "safe" },
  { pattern: /\bnpm\s+run\s+test\b/i, level: "safe" },
  { pattern: /\bbun\s+test\b/i, level: "safe" },
  { pattern: /\bcargo\s+test\b/i, level: "safe" },
  { pattern: /\bgo\s+test\b/i, level: "safe" },
  { pattern: /\bpython\s+-m\s+pytest\b/i, level: "safe" },
  { pattern: /\bpytest\b/i, level: "safe" },
  { pattern: /^\s*find\b/i, level: "safe" },
  { pattern: /^\s*grep\b/i, level: "safe" },
  { pattern: /^\s*rg\b/i, level: "safe" },
  { pattern: /^\s*fd\b/i, level: "safe" },
  { pattern: /^\s*tree\b/i, level: "safe" },
];

export interface BashClassifierConfig {
  allowedCommands?: string[];
  blockedCommands?: string[];
}

/**
 * Classify a bash command by risk level, checking dangerous patterns first
 * (highest priority) then moderate, then safe. Unknown commands default to moderate.
 */
export function classifyCommand(
  command: string,
  config?: BashClassifierConfig,
): RiskLevel {
  const trimmed = command.trim();

  if (config?.blockedCommands?.some((blocked) => trimmed.includes(blocked))) {
    return "dangerous";
  }
  if (config?.allowedCommands?.some((allowed) => trimmed.startsWith(allowed))) {
    return "safe";
  }

  for (const rule of DANGEROUS_PATTERNS) {
    if (rule.pattern.test(trimmed)) return "dangerous";
  }

  for (const rule of SAFE_PATTERNS) {
    if (rule.pattern.test(trimmed)) return "safe";
  }

  for (const rule of MODERATE_PATTERNS) {
    if (rule.pattern.test(trimmed)) return "moderate";
  }

  return "moderate";
}

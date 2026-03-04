import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

export interface GitStatusSummary {
  modified: number;
  staged: number;
  untracked: number;
  conflicts: boolean;
}

export interface GitContext {
  isGitRepository: boolean;
  isWorktree: boolean;
  branch?: string;
  status?: GitStatusSummary;
  recentCommits: string[];
  remotes: string[];
  worktrees: string[];
  gitignorePatterns: string[];
}

function runGit(cwd: string, command: string): string {
  return execSync(command, {
    cwd,
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
  }).trim();
}

async function loadGitignorePatterns(cwd: string): Promise<string[]> {
  const gitignorePath = path.join(cwd, ".gitignore");
  try {
    const content = await fs.readFile(gitignorePath, "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } catch {
    return [];
  }
}

function parseStatusPorcelain(statusPorcelain: string): GitStatusSummary {
  let modified = 0;
  let staged = 0;
  let untracked = 0;
  let conflicts = false;

  for (const line of statusPorcelain.split(/\r?\n/)) {
    if (!line) continue;
    const x = line[0] ?? " ";
    const y = line[1] ?? " ";

    if (x === "?" && y === "?") {
      untracked += 1;
      continue;
    }

    if (x !== " ") staged += 1;
    if (y !== " ") modified += 1;

    if ("UDAAUUDD".includes(x) || "UDAAUUDD".includes(y)) {
      conflicts = true;
    }
  }

  return { modified, staged, untracked, conflicts };
}

export async function detectGitContext(
  cwd: string = process.cwd(),
): Promise<GitContext> {
  let isGitRepository = false;
  try {
    isGitRepository = runGit(cwd, "git rev-parse --is-inside-work-tree") === "true";
  } catch {
    isGitRepository = false;
  }

  if (!isGitRepository) {
    return {
      isGitRepository: false,
      isWorktree: false,
      recentCommits: [],
      remotes: [],
      worktrees: [],
      gitignorePatterns: [],
    };
  }

  const branch = runGit(cwd, "git rev-parse --abbrev-ref HEAD");
  const statusRaw = runGit(cwd, "git status --porcelain=v1");
  const status = parseStatusPorcelain(statusRaw);
  const recentCommits = runGit(cwd, "git log --oneline -10")
    .split(/\r?\n/)
    .filter(Boolean);
  const remotes = runGit(cwd, "git remote -v")
    .split(/\r?\n/)
    .filter(Boolean);
  const worktrees = runGit(cwd, "git worktree list")
    .split(/\r?\n/)
    .filter(Boolean);
  const gitignorePatterns = await loadGitignorePatterns(cwd);

  return {
    isGitRepository: true,
    isWorktree: worktrees.length > 1,
    branch,
    status,
    recentCommits,
    remotes,
    worktrees,
    gitignorePatterns,
  };
}

export function formatGitContextForPrompt(context: GitContext): string {
  if (!context.isGitRepository) {
    return "- Not inside a git repository.";
  }

  const status = context.status;
  const statusLine = status
    ? `- Status: modified=${status.modified}, staged=${status.staged}, untracked=${status.untracked}, conflicts=${status.conflicts ? "yes" : "no"}`
    : "- Status: unavailable";

  const commits =
    context.recentCommits.length > 0
      ? context.recentCommits.map((line) => `  - ${line}`).join("\n")
      : "  - none";

  const remotes =
    context.remotes.length > 0
      ? context.remotes.map((line) => `  - ${line}`).join("\n")
      : "  - none";

  return [
    `- Branch: ${context.branch ?? "unknown"}`,
    `- Worktree: ${context.isWorktree ? "yes" : "no"}`,
    statusLine,
    "- Recent commits:",
    commits,
    "- Remotes:",
    remotes,
  ].join("\n");
}

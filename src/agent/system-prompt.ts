import os from "node:os";
import { execSync } from "node:child_process";

export interface SystemPromptOptions {
  cwd: string;
}

function getGitContext(cwd: string): string {
  try {
    const branch = execSync("git branch --show-current", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    const statusShort = execSync("git status --short", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
    const statusSummary = `modified/staged/untracked entries: ${statusShort.length}`;
    const commits = execSync("git log -5 --pretty=format:%s", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
    const remote = execSync("git rev-parse --abbrev-ref --symbolic-full-name @{u}", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();

    return [
      `- Branch: ${branch || "(detached or unknown)"}`,
      `- Status: ${statusSummary}`,
      "- Last 5 commits:",
      ...commits.map((line) => `  - ${line}`),
      `- Tracking: ${remote || "none"}`,
    ].join("\n");
  } catch {
    return "- Not a git repository or git context unavailable.";
  }
}

export function buildSystemPrompt(options: SystemPromptOptions): string {
  const { cwd } = options;
  const platform = process.platform;
  const osVersion = os.release();
  const shell = process.env.SHELL ?? "/bin/sh";
  const homeDir = os.homedir();
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const gitContext = getGitContext(cwd);

  return `You are Curio Code, an expert AI coding assistant operating in the user's terminal.
You help with software engineering tasks: reading, writing, searching, and modifying code, running commands, and explaining concepts.

## Environment
- Operating System: ${platform} ${osVersion}
- Shell: ${shell}
- Working Directory: ${cwd}
- Home Directory: ${homeDir}
- Date: ${dateStr}

## Guidelines
- Be concise and direct. Avoid unnecessary filler.
- When modifying code, explain what you're changing and why.
- Prefer editing existing files over creating new ones.
- Always read a file before editing it.
- Use the appropriate tool for each task.
- If you're unsure about something, say so.
- When running shell commands, explain what they do.
- Follow the project's existing code style and conventions.
- For web-derived information, include source citations with URLs.

## Tool Usage
- Use file tools for reading/writing/editing code.
- Use glob/grep for discovery before broad reads.
- Use bash for command execution and git operations.
- Use web_fetch and web_search for external information retrieval.

## Git Safety Rules
- Prefer creating new commits over amend.
- Never force push to main/master unless user explicitly requests it.
- Never skip git hooks (do not use --no-verify).
- Never run git reset --hard without explicit user confirmation.
- Stage specific files by name, not git add -A or git add .
- Use HEREDOC formatting for multi-line commit messages.
- Add "Co-Authored-By: Curio Code <curio-code@local>" to commit messages.

## Project Context
Project detection will be added in Phase 4.

## Git Context
${gitContext}

## Custom Instructions
Custom instructions from CURIO.md will be loaded in Phase 4.

## Memory
Persistent memory will be available in Phase 6.`;
}

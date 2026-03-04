import os from "node:os";
import { spawnSync } from "node:child_process";

export interface EnvironmentContext {
  os: string;
  osVersion: string;
  shell: string;
  cwd: string;
  term: string;
  nowIso: string;
  availableTools: string[];
  availableRuntimes: string[];
}

function commandExists(command: string): boolean {
  const result = spawnSync("which", [command], {
    stdio: "ignore",
  });
  return result.status === 0;
}

export function detectEnvironmentContext(
  cwd: string = process.cwd(),
): EnvironmentContext {
  const candidateTools = ["git", "rg", "fd", "gh", "docker", "bun", "npm", "pnpm", "yarn"];
  const candidateRuntimes = [
    "node",
    "python",
    "python3",
    "go",
    "rustc",
    "java",
    "ruby",
    "php",
  ];

  return {
    os: process.platform,
    osVersion: os.release(),
    shell: process.env.SHELL ?? "/bin/sh",
    cwd,
    term: process.env.TERM ?? "unknown",
    nowIso: new Date().toISOString(),
    availableTools: candidateTools.filter(commandExists),
    availableRuntimes: candidateRuntimes.filter(commandExists),
  };
}

export function formatEnvironmentContextForPrompt(
  env: EnvironmentContext,
): string {
  const toolLine =
    env.availableTools.length > 0 ? env.availableTools.join(", ") : "none detected";
  const runtimeLine =
    env.availableRuntimes.length > 0
      ? env.availableRuntimes.join(", ")
      : "none detected";

  return [
    `- Operating System: ${env.os} ${env.osVersion}`,
    `- Shell: ${env.shell}`,
    `- Working Directory: ${env.cwd}`,
    `- Date/Time (ISO): ${env.nowIso}`,
    `- Terminal: ${env.term}`,
    `- Available Tools: ${toolLine}`,
    `- Available Runtimes: ${runtimeLine}`,
  ].join("\n");
}

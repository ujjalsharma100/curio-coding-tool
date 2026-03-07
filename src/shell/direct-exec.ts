import { spawn } from "node:child_process";
import process from "node:process";

export interface DirectExecResult {
  command: string;
  exitCode: number;
  output: string;
}

/**
 * Commands that typically require an interactive TTY and won't work
 * in a piped/captured environment.
 */
const INTERACTIVE_COMMANDS = new Set([
  "vim", "nvim", "vi", "nano", "emacs",
  "top", "htop", "btop",
  "less", "more", "man",
  "ssh", "ftp", "telnet",
  "python", "python3", "node", "irb", "ghci",  // REPLs without args
]);

/**
 * Check if a command requires an interactive terminal.
 * Returns the command name if interactive, null otherwise.
 */
export function detectInteractiveCommand(command: string): string | null {
  const trimmed = command.trim();
  // Extract the base command (first word, strip env vars and sudo)
  const parts = trimmed.split(/\s+/);
  let cmdName = parts[0] ?? "";

  // Skip env vars (FOO=bar), sudo, etc.
  let i = 0;
  while (i < parts.length) {
    const p = parts[i]!;
    if (p.includes("=") || p === "sudo" || p === "env") {
      i++;
      continue;
    }
    cmdName = p;
    break;
  }

  // Strip path prefix
  const baseName = cmdName.split("/").pop() ?? cmdName;

  // REPLs only count as interactive when invoked without arguments
  const replCommands = new Set(["python", "python3", "node", "irb", "ghci"]);
  if (replCommands.has(baseName)) {
    // If there are additional args beyond the command name, it's likely a script
    const remainingArgs = parts.slice(i + 1);
    if (remainingArgs.length > 0) return null;
  }

  return INTERACTIVE_COMMANDS.has(baseName) ? baseName : null;
}

/**
 * Execute a shell command directly (via `!` prefix) without sending to the LLM.
 * Returns the combined stdout+stderr output and exit code.
 */
export function directExec(
  command: string,
  cwd: string,
  onData?: (chunk: string) => void,
): Promise<DirectExecResult> {
  return new Promise((resolve) => {
    const shell = process.env.SHELL ?? "/bin/sh";
    const child = spawn(shell, ["-c", command], {
      cwd,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";

    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      output += text;
      onData?.(text);
    });

    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      output += text;
      onData?.(text);
    });

    child.on("error", (err) => {
      resolve({ command, exitCode: 1, output: err.message });
    });

    child.on("close", (code) => {
      resolve({ command, exitCode: code ?? 0, output: output.trimEnd() });
    });

    // Store kill function so caller can abort
    (directExec as { _currentChild?: typeof child })._currentChild = child;
  });
}

/**
 * Kill the currently running direct exec child process.
 */
export function killDirectExec(): void {
  const child = (directExec as { _currentChild?: { kill: (sig: string) => void } })._currentChild;
  if (child) {
    child.kill("SIGTERM");
    (directExec as { _currentChild?: unknown })._currentChild = undefined;
  }
}

import path from "node:path";
import { spawn } from "node:child_process";
import { createTool } from "curio-agent-sdk";
import { z } from "zod";
import { toolSessionState } from "./session-state.js";

const DEFAULT_TIMEOUT = 120_000;
const MAX_TIMEOUT = 600_000;
const MAX_OUTPUT_LINES = 10_000;

function extractCdTarget(command: string): string | null {
  const match = command.match(/(?:^|&&|;)\s*cd\s+("[^"]+"|'[^']+'|[^\s;&]+)/);
  if (!match) {
    return null;
  }
  return match[1].replace(/^['"]|['"]$/g, "");
}

function truncateOutput(output: string): string {
  const lines = output.split(/\r?\n/);
  if (lines.length <= MAX_OUTPUT_LINES) {
    return output;
  }
  const kept = lines.slice(0, MAX_OUTPUT_LINES).join("\n");
  return `${kept}\n[truncated - ${lines.length - MAX_OUTPUT_LINES} more lines]`;
}

async function executeForeground(command: string, timeoutMs: number): Promise<string> {
  const shell = process.env.SHELL ?? "/bin/sh";
  const cwd = toolSessionState.getBashCwd();

  return new Promise((resolve) => {
    const child = spawn(shell, ["-c", command], {
      cwd,
      env: process.env,
    });

    let output = "";
    let timedOut = false;

    const onSigint = () => {
      child.kill("SIGINT");
    };
    process.once("SIGINT", onSigint);

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      process.removeListener("SIGINT", onSigint);
      const maybeCd = extractCdTarget(command);
      if (maybeCd) {
        const nextCwd = path.resolve(cwd, maybeCd);
        toolSessionState.setBashCwd(nextCwd);
      }

      const finalOutput = truncateOutput(output);
      if (timedOut) {
        resolve(
          `Exit code: ${code ?? 1}\nOutput:\n${finalOutput}\nCommand timed out after ${timeoutMs}ms`,
        );
        return;
      }
      resolve(`Exit code: ${code ?? 0}\nOutput:\n${finalOutput}`);
    });
  });
}

function executeInBackground(command: string): string {
  const shell = process.env.SHELL ?? "/bin/sh";
  const cwd = toolSessionState.getBashCwd();
  const taskId = toolSessionState.createBackgroundTask(command, cwd);
  const child = spawn(shell, ["-c", command], {
    cwd,
    env: process.env,
  });

  child.stdout.on("data", (chunk) => {
    toolSessionState.appendBackgroundTaskOutput(taskId, chunk.toString());
  });
  child.stderr.on("data", (chunk) => {
    toolSessionState.appendBackgroundTaskOutput(taskId, chunk.toString());
  });
  child.on("close", (code) => {
    toolSessionState.finishBackgroundTask(taskId, code);
  });

  const maybeCd = extractCdTarget(command);
  if (maybeCd) {
    const nextCwd = path.resolve(cwd, maybeCd);
    toolSessionState.setBashCwd(nextCwd);
  }

  return `Started background task ${taskId}\nUse bash_task_output with task_id to inspect output.`;
}

export const bashTool = createTool({
  name: "bash",
  description: "Execute shell commands with persistent working directory and timeout controls.",
  parameters: z.object({
    command: z.string().describe("Shell command to execute"),
    description: z.string().optional().describe("What this command does"),
    timeout: z.number().optional().describe("Timeout in milliseconds (max 600000)"),
    run_in_background: z.boolean().optional().describe("Run in background"),
  }),
  execute: async ({ command, timeout, run_in_background }) => {
    const timeoutMs = Math.min(Math.max(timeout ?? DEFAULT_TIMEOUT, 1), MAX_TIMEOUT);
    if (run_in_background) {
      return executeInBackground(command);
    }
    return executeForeground(command, timeoutMs);
  },
});

export const bashTaskOutputTool = createTool({
  name: "bash_task_output",
  description: "Get status and output from a background bash task.",
  parameters: z.object({
    task_id: z.string().describe("Background task ID"),
  }),
  execute: async ({ task_id }) => {
    const task = toolSessionState.getBackgroundTask(task_id);
    if (!task) {
      return `Task not found: ${task_id}`;
    }
    return JSON.stringify(
      {
        id: task.id,
        command: task.command,
        cwd: task.cwd,
        running: task.running,
        exit_code: task.exitCode,
        output: truncateOutput(task.output),
      },
      null,
      2,
    );
  },
});

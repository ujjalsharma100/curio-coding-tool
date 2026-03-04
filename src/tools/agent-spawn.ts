import { createTool } from "curio-agent-sdk";
import type { Agent } from "curio-agent-sdk";
import { z } from "zod";
import { randomUUID } from "node:crypto";

export interface SubagentTask {
  id: string;
  subagentType: string;
  description: string;
  status: "running" | "completed" | "error";
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export class SubagentTaskRegistry {
  private tasks = new Map<string, SubagentTask>();

  register(task: SubagentTask): void {
    this.tasks.set(task.id, task);
  }

  complete(id: string, result: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = "completed";
      task.result = result;
      task.completedAt = new Date().toISOString();
    }
  }

  fail(id: string, error: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = "error";
      task.error = error;
      task.completedAt = new Date().toISOString();
    }
  }

  get(id: string): SubagentTask | undefined {
    return this.tasks.get(id);
  }

  list(): SubagentTask[] {
    return Array.from(this.tasks.values());
  }
}

export function createAgentSpawnTool(
  parentAgent: Agent,
  registry: SubagentTaskRegistry,
) {
  return createTool({
    name: "agent_spawn",
    description:
      "Spawn a subagent to handle a task autonomously. " +
      "Available types: explore (fast, read-only for codebase exploration), " +
      "plan (read + research for architecture planning), " +
      "general (full tool access for coding tasks). " +
      "Foreground: waits for result. Background: returns task ID to check later.",
    parameters: z.object({
      subagent_type: z
        .enum(["explore", "plan", "general"])
        .describe("Type of subagent to spawn"),
      prompt: z.string().describe("Task description for the subagent"),
      description: z
        .string()
        .optional()
        .describe("Short description of the task (3-5 words)"),
      run_in_background: z
        .boolean()
        .optional()
        .describe("If true, run in background and return task ID immediately"),
    }),
    execute: async (args) => {
      const taskId = randomUUID().slice(0, 8);
      const task: SubagentTask = {
        id: taskId,
        subagentType: args.subagent_type,
        description: args.description ?? args.prompt.slice(0, 60),
        status: "running",
        startedAt: new Date().toISOString(),
      };
      registry.register(task);

      const hasSubagent = parentAgent.subagents.has(args.subagent_type);
      if (!hasSubagent) {
        registry.fail(taskId, `Subagent type '${args.subagent_type}' not configured.`);
        return `Error: Subagent type '${args.subagent_type}' is not configured. Available: ${Array.from(parentAgent.subagents.keys()).join(", ") || "none"}`;
      }

      if (args.run_in_background) {
        runSubagentAsync(parentAgent, args.subagent_type, args.prompt, taskId, registry);
        return [
          `Subagent spawned in background.`,
          `Task ID: ${taskId}`,
          `Type: ${args.subagent_type}`,
          `Check status with /task ${taskId} or use the task_output tool.`,
        ].join("\n");
      }

      try {
        const result = await parentAgent.spawnSubagent(args.subagent_type, args.prompt);
        const output = result.output ?? "(no output)";
        registry.complete(taskId, output);
        return output;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        registry.fail(taskId, message);
        return `Subagent error: ${message}`;
      }
    },
  });
}

function runSubagentAsync(
  parentAgent: Agent,
  type: string,
  prompt: string,
  taskId: string,
  registry: SubagentTaskRegistry,
): void {
  parentAgent
    .spawnSubagent(type, prompt)
    .then((result) => {
      registry.complete(taskId, result.output ?? "(no output)");
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      registry.fail(taskId, message);
    });
}

export function createTaskOutputTool(registry: SubagentTaskRegistry) {
  return createTool({
    name: "task_output",
    description: "Check the status and output of a background subagent task.",
    parameters: z.object({
      id: z.string().describe("Task ID returned by agent_spawn"),
    }),
    execute: async (args) => {
      const task = registry.get(args.id);
      if (!task) return `Task not found: ${args.id}`;

      const lines = [
        `Task: ${task.id}`,
        `Type: ${task.subagentType}`,
        `Status: ${task.status}`,
        `Description: ${task.description}`,
        `Started: ${task.startedAt}`,
      ];

      if (task.completedAt) lines.push(`Completed: ${task.completedAt}`);
      if (task.result) lines.push("", "Output:", task.result);
      if (task.error) lines.push("", `Error: ${task.error}`);

      return lines.join("\n");
    },
  });
}

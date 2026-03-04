import { createTool } from "curio-agent-sdk";
import { z } from "zod";
import type { TodoManager } from "./todo-manager.js";

export function createTodoTools(manager: TodoManager) {
  const taskCreate = createTool({
    name: "task_create",
    description:
      "Create a new task/todo item for tracking progress on multi-step work.",
    parameters: z.object({
      subject: z.string().describe("Short title for the task"),
      description: z
        .string()
        .describe("Detailed description of what needs to be done"),
      blocked_by: z
        .array(z.string())
        .optional()
        .describe("IDs of tasks that must complete before this one can start"),
    }),
    execute: async (args) => {
      const todo = manager.create({
        subject: args.subject,
        description: args.description,
        blockedBy: args.blocked_by,
      });
      return JSON.stringify(todo, null, 2);
    },
  });

  const taskUpdate = createTool({
    name: "task_update",
    description:
      "Update a task's status or details. Status transitions: pending → in_progress → completed.",
    parameters: z.object({
      id: z.string().describe("Task ID to update"),
      status: z
        .enum(["pending", "in_progress", "completed"])
        .optional()
        .describe("New status"),
      subject: z.string().optional().describe("Updated subject"),
      description: z.string().optional().describe("Updated description"),
      active_form: z
        .string()
        .optional()
        .describe("Current activity description shown in spinner, e.g. 'Running tests'"),
    }),
    execute: async (args) => {
      try {
        const todo = manager.update(args.id, {
          status: args.status,
          subject: args.subject,
          description: args.description,
          activeForm: args.active_form,
        });
        return JSON.stringify(todo, null, 2);
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const taskList = createTool({
    name: "task_list",
    description: "List all tasks with their current status and summary.",
    parameters: z.object({}),
    execute: async () => {
      return manager.summary();
    },
  });

  const taskGet = createTool({
    name: "task_get",
    description: "Get full details of a specific task by ID.",
    parameters: z.object({
      id: z.string().describe("Task ID"),
    }),
    execute: async (args) => {
      const todo = manager.get(args.id);
      if (!todo) return `Task not found: ${args.id}`;
      return JSON.stringify(todo, null, 2);
    },
  });

  return [taskCreate, taskUpdate, taskList, taskGet];
}

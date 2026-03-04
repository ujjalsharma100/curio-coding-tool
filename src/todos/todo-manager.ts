import { randomUUID } from "node:crypto";
import type { Todo, TodoCreate, TodoUpdate } from "./todo-model.js";
import { isValidTransition } from "./todo-model.js";

export class TodoManager {
  private todos = new Map<string, Todo>();

  create(input: TodoCreate): Todo {
    const now = new Date().toISOString();
    const todo: Todo = {
      id: randomUUID().slice(0, 8),
      subject: input.subject,
      description: input.description,
      status: "pending",
      activeForm: input.activeForm,
      owner: input.owner,
      blockedBy: input.blockedBy ?? [],
      blocks: input.blocks ?? [],
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.todos.set(todo.id, todo);
    return todo;
  }

  update(id: string, changes: TodoUpdate): Todo {
    const todo = this.todos.get(id);
    if (!todo) {
      throw new Error(`Todo not found: ${id}`);
    }

    if (changes.status && changes.status !== todo.status) {
      if (!isValidTransition(todo.status, changes.status)) {
        throw new Error(
          `Invalid status transition: ${todo.status} → ${changes.status}`,
        );
      }

      if (changes.status === "in_progress") {
        const unblockedDeps = todo.blockedBy.filter((depId) => {
          const dep = this.todos.get(depId);
          return dep && dep.status !== "completed";
        });
        if (unblockedDeps.length > 0) {
          throw new Error(
            `Cannot start task: blocked by ${unblockedDeps.join(", ")}`,
          );
        }
      }
    }

    const updated: Todo = {
      ...todo,
      ...changes,
      id: todo.id,
      createdAt: todo.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.todos.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.todos.delete(id);
  }

  get(id: string): Todo | undefined {
    return this.todos.get(id);
  }

  list(): Todo[] {
    return Array.from(this.todos.values());
  }

  summary(): string {
    const all = this.list();
    if (all.length === 0) return "No tasks.";

    const pending = all.filter((t) => t.status === "pending").length;
    const inProgress = all.filter((t) => t.status === "in_progress").length;
    const completed = all.filter((t) => t.status === "completed").length;

    const lines: string[] = [
      `Tasks: ${all.length} total — ${completed} completed, ${inProgress} in progress, ${pending} pending`,
      "",
    ];

    for (const t of all) {
      const icon =
        t.status === "completed" ? "✓" : t.status === "in_progress" ? "▶" : "○";
      const blockedNote =
        t.blockedBy.length > 0 ? ` [blocked by: ${t.blockedBy.join(", ")}]` : "";
      const activeNote = t.activeForm ? ` (${t.activeForm})` : "";
      lines.push(`  ${icon} [${t.id}] ${t.subject} — ${t.status}${activeNote}${blockedNote}`);
    }

    return lines.join("\n");
  }

  clear(): void {
    this.todos.clear();
  }

  toJSON(): Todo[] {
    return this.list();
  }

  fromJSON(todos: Todo[]): void {
    this.todos.clear();
    for (const t of todos) {
      this.todos.set(t.id, t);
    }
  }
}

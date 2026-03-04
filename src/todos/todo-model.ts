export type TodoStatus = "pending" | "in_progress" | "completed";

export interface Todo {
  id: string;
  subject: string;
  description: string;
  status: TodoStatus;
  activeForm?: string;
  owner?: string;
  blockedBy: string[];
  blocks: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type TodoCreate = Pick<Todo, "subject" | "description"> &
  Partial<Pick<Todo, "owner" | "blockedBy" | "blocks" | "metadata" | "activeForm">>;

export type TodoUpdate = Partial<
  Pick<Todo, "subject" | "description" | "status" | "activeForm" | "owner" | "blockedBy" | "blocks" | "metadata">
>;

const VALID_TRANSITIONS: Record<TodoStatus, TodoStatus[]> = {
  pending: ["in_progress", "completed"],
  in_progress: ["completed", "pending"],
  completed: [],
};

export function isValidTransition(from: TodoStatus, to: TodoStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

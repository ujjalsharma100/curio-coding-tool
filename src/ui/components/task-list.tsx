import React from "react";
import { Box, Text } from "ink";
import type { Todo } from "../../todos/todo-model.js";

interface TaskListProps {
  readonly todos: Todo[];
  readonly theme: {
    primary: string;
    success: string;
    warning: string;
    muted: string;
    error: string;
  };
}

function statusIcon(status: Todo["status"]): string {
  switch (status) {
    case "completed":
      return "✓";
    case "in_progress":
      return "▶";
    case "pending":
      return "○";
  }
}

function statusColor(
  status: Todo["status"],
  theme: TaskListProps["theme"],
): string {
  switch (status) {
    case "completed":
      return theme.success;
    case "in_progress":
      return theme.warning;
    case "pending":
      return theme.muted;
  }
}

export function TaskList({ todos, theme }: TaskListProps): JSX.Element {
  if (todos.length === 0) {
    return (
      <Box>
        <Text color={theme.muted}>No tasks.</Text>
      </Box>
    );
  }

  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barWidth = 20;
  const filled = Math.round((completed / total) * barWidth);
  const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>
          Tasks [{bar}] {pct}% ({completed}/{total})
        </Text>
      </Box>
      {todos.map((todo) => (
        <Box key={todo.id} paddingLeft={1}>
          <Text color={statusColor(todo.status, theme)}>
            {statusIcon(todo.status)} [{todo.id}] {todo.subject}
          </Text>
          {todo.activeForm && (
            <Text color={theme.muted}> ({todo.activeForm})</Text>
          )}
          {todo.blockedBy.length > 0 && (
            <Text color={theme.error}>
              {" "}
              [blocked by: {todo.blockedBy.join(", ")}]
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

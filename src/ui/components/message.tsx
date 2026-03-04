import React from "react";
import { Box, Text } from "ink";
import { renderMarkdownToAnsi } from "../markdown.js";
import type { Theme } from "../theme.js";

export type MessageRole = "user" | "assistant";

export interface MessageProps {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly theme: Theme;
}

export function Message({
  role,
  content,
  theme,
}: MessageProps): JSX.Element | null {
  if (!content.trim()) return null;

  const isUser = role === "user";
  const label = isUser ? "You" : "Curio";
  const labelColor = isUser ? theme.accent : theme.accentSoft;

  const body =
    role === "assistant" ? renderMarkdownToAnsi(content) : content.trimEnd();

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={labelColor}>
        {label}
        <Text color={theme.muted}>:</Text>
      </Text>
      <Text>{body}</Text>
    </Box>
  );
}


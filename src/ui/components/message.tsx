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

  if (isUser) {
    return (
      <Box flexDirection="column" marginBottom={1} paddingX={1} paddingY={0}
        borderStyle="single" borderColor={theme.dim}>
        <Text color={theme.accent} wrap="wrap">{content.trimEnd()}</Text>
      </Box>
    );
  }

  const body = renderMarkdownToAnsi(content);

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Text wrap="wrap">{body}</Text>
    </Box>
  );
}

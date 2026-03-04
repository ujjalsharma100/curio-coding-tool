import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import type { Theme } from "../theme.js";

export type PermissionChoice = "yes" | "no" | "always";

export interface PermissionPromptProps {
  readonly toolName: string;
  readonly description: string;
  readonly detail?: string;
  readonly theme: Theme;
  readonly onResolve: (choice: PermissionChoice) => void;
}

export function PermissionPrompt({
  toolName,
  description,
  detail,
  theme,
  onResolve,
}: PermissionPromptProps): JSX.Element {
  const [resolved, setResolved] = useState(false);

  const handleInput = useCallback(
    (input: string) => {
      if (resolved) return;
      const key = input.toLowerCase();
      if (key === "y") {
        setResolved(true);
        onResolve("yes");
      } else if (key === "n") {
        setResolved(true);
        onResolve("no");
      } else if (key === "a") {
        setResolved(true);
        onResolve("always");
      }
    },
    [resolved, onResolve],
  );

  useInput((_input, key) => {
    if (key.escape) {
      setResolved(true);
      onResolve("no");
      return;
    }
    handleInput(_input);
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.warning}
      paddingX={1}
    >
      <Text bold color={theme.warning}>
        ⚠ Permission Required
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text bold>Tool: </Text>
          <Text color={theme.accent}>{toolName}</Text>
        </Text>
        <Text>
          <Text bold>Action: </Text>
          {description}
        </Text>
        {detail && (
          <Text>
            <Text bold>Detail: </Text>
            <Text color={theme.muted}>{detail}</Text>
          </Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text>
          <Text color={theme.success}>[y]</Text>
          <Text>es  </Text>
          <Text color={theme.danger}>[n]</Text>
          <Text>o  </Text>
          <Text color={theme.info}>[a]</Text>
          <Text>lways allow this tool</Text>
        </Text>
      </Box>
    </Box>
  );
}

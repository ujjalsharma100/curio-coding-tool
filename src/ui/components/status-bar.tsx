import React from "react";
import { Box, Text } from "ink";
import type { Theme } from "../theme.js";

export interface StatusBarProps {
  readonly theme: Theme;
  readonly modelDisplayName: string;
  readonly providerDisplayName: string;
  readonly sessionId?: string;
  readonly totalPromptTokens?: number;
  readonly totalCompletionTokens?: number;
  readonly lastDurationMs?: number;
  readonly contextBudgetLabel?: string;
}

export function StatusBar({
  theme,
  modelDisplayName,
  providerDisplayName,
  sessionId,
  totalPromptTokens,
  totalCompletionTokens,
  lastDurationMs,
  contextBudgetLabel,
}: StatusBarProps): JSX.Element {
  const sessionLabel = sessionId ? sessionId.slice(0, 8) : "local";
  const tokenLabel =
    totalPromptTokens != null && totalCompletionTokens != null
      ? `tokens ${totalPromptTokens} in / ${totalCompletionTokens} out`
      : "";
  const durationLabel =
    lastDurationMs != null ? `${(lastDurationMs / 1000).toFixed(1)}s` : "";

  return (
    <Box
      paddingX={1}
      paddingY={0}
      borderStyle="single"
      borderColor={theme.accentSoft}
    >
      <Text color={theme.accent}>
        Curio Code · {modelDisplayName} ({providerDisplayName})
      </Text>
      <Text color={theme.muted}> │ </Text>
      <Text color={theme.muted}>session {sessionLabel}</Text>
      {tokenLabel && (
        <>
          <Text color={theme.muted}> │ </Text>
          <Text color={theme.info}>{tokenLabel}</Text>
        </>
      )}
      {durationLabel && (
        <>
          <Text color={theme.muted}> │ </Text>
          <Text color={theme.muted}>last {durationLabel}</Text>
        </>
      )}
      {contextBudgetLabel && (
        <>
          <Text color={theme.muted}> │ </Text>
          <Text color={theme.warning}>context {contextBudgetLabel}</Text>
        </>
      )}
    </Box>
  );
}


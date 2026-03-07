import React from "react";
import { Box, Text } from "ink";
import type { Theme } from "../theme.js";

export interface TopBarProps {
  readonly theme: Theme;
  readonly workingDirectory: string;
  readonly gitBranch?: string;
  readonly modelDisplayName: string;
  readonly providerDisplayName: string;
  readonly totalPromptTokens?: number;
  readonly totalCompletionTokens?: number;
  readonly termWidth: number;
}

function abbreviatePath(fullPath: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  if (home && fullPath.startsWith(home)) {
    return "~" + fullPath.slice(home.length);
  }
  return fullPath;
}

export function TopBar({
  theme,
  workingDirectory,
  gitBranch,
  modelDisplayName,
  providerDisplayName,
  totalPromptTokens,
  totalCompletionTokens,
  termWidth,
}: TopBarProps): JSX.Element {
  const pathLabel = abbreviatePath(workingDirectory);
  const branchLabel = gitBranch ? ` (${gitBranch})` : "";
  const isNarrow = termWidth < 100;

  const tokenLabel =
    !isNarrow && totalPromptTokens != null && totalCompletionTokens != null
      ? `${totalPromptTokens}/${totalCompletionTokens}`
      : "";

  return (
    <Box
      paddingX={1}
      borderStyle="round"
      borderColor={theme.dim}
      width={termWidth}
      justifyContent="space-between"
    >
      <Box>
        <Text color={theme.accent} bold>Curio Code</Text>
        <Text color={theme.dim}> | </Text>
        <Text color={theme.muted}>
          {isNarrow ? pathLabel.split("/").pop() ?? pathLabel : pathLabel}
        </Text>
        {gitBranch && <Text color={theme.info}>{branchLabel}</Text>}
      </Box>
      <Box>
        {tokenLabel ? (
          <>
            <Text color={theme.muted}>{tokenLabel}</Text>
            <Text color={theme.dim}> | </Text>
          </>
        ) : null}
        <Text color={theme.accentSoft}>
          {isNarrow ? modelDisplayName.split("-").slice(0, 2).join("-") : modelDisplayName}
        </Text>
        <Text color={theme.dim}> · </Text>
        <Text color={theme.muted}>{providerDisplayName}</Text>
      </Box>
    </Box>
  );
}

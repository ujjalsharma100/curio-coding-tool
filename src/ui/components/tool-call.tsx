import React from "react";
import { Box, Text } from "ink";
import type { Theme } from "../theme.js";
import { Spinner } from "./spinner.js";

export interface ToolCallViewProps {
  readonly theme: Theme;
  readonly name: string;
  readonly argsPreview: string;
  readonly status: "running" | "completed" | "error";
  readonly durationMs?: number;
  readonly resultPreview?: string;
  readonly errorMessage?: string;
}

export function ToolCallView({
  theme,
  name,
  argsPreview,
  status,
  durationMs,
  resultPreview,
  errorMessage,
}: ToolCallViewProps): JSX.Element {
  const durationLabel =
    durationMs != null ? `${durationMs.toFixed(0)}ms` : undefined;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        {status === "running" ? (
          <Spinner theme={theme} label={`Tool ${name}`} />
        ) : (
          <Text color={theme.accentSoft}>
            ✓{" "}
            <Text color={theme.accentSoft}>
              Tool {name}
              {durationLabel ? ` (${durationLabel})` : ""}
            </Text>
          </Text>
        )}
      </Box>
      <Box marginLeft={2} flexDirection="column">
        <Text color={theme.muted}>
          args:{" "}
          {argsPreview.length > 200
            ? `${argsPreview.slice(0, 200)}…`
            : argsPreview}
        </Text>
        {status === "error" && errorMessage && (
          <Text color={theme.danger}>error: {errorMessage}</Text>
        )}
        {resultPreview && status !== "running" && (
          <Text>{resultPreview}</Text>
        )}
      </Box>
    </Box>
  );
}


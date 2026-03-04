import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Theme } from "../theme.js";
import { Spinner } from "./spinner.js";

const COLLAPSE_THRESHOLD = 10;
const MAX_PREVIEW_LINES = 6;

export interface ToolCallViewProps {
  readonly theme: Theme;
  readonly name: string;
  readonly argsPreview: string;
  readonly toolArgs?: Record<string, unknown>;
  readonly status: "running" | "completed" | "error";
  readonly durationMs?: number;
  readonly resultPreview?: string;
  readonly errorMessage?: string;
  readonly focused?: boolean;
}

/* ── Tool icon mapping ────────────────────────────────────────────── */

function toolIcon(name: string): string {
  switch (name) {
    case "file_read":
      return "📄";
    case "file_write":
      return "✏️";
    case "file_edit":
      return "🔧";
    case "glob":
      return "🔍";
    case "grep":
      return "🔎";
    case "bash":
    case "shell_execute":
      return "💻";
    case "web_fetch":
      return "🌐";
    case "web_search":
      return "🔗";
    case "notebook_edit":
      return "📓";
    default:
      return "⚡";
  }
}

/* ── Tool-specific argument summaries ─────────────────────────────── */

function toolArgsSummary(
  name: string,
  toolArgs?: Record<string, unknown>,
): string | null {
  if (!toolArgs) return null;
  switch (name) {
    case "file_read":
      return toolArgs.file_path ? String(toolArgs.file_path) : null;
    case "file_write":
      return toolArgs.file_path ? String(toolArgs.file_path) : null;
    case "file_edit":
      return toolArgs.file_path ? String(toolArgs.file_path) : null;
    case "glob":
      return toolArgs.pattern ? String(toolArgs.pattern) : null;
    case "grep":
      return toolArgs.pattern ? String(toolArgs.pattern) : null;
    case "bash":
    case "shell_execute": {
      const cmd = toolArgs.command ? String(toolArgs.command) : null;
      return cmd && cmd.length > 80 ? `${cmd.slice(0, 80)}…` : cmd;
    }
    case "web_fetch":
      return toolArgs.url ? String(toolArgs.url) : null;
    case "web_search":
      return toolArgs.query ? String(toolArgs.query) : null;
    case "notebook_edit":
      return toolArgs.notebook_path ? String(toolArgs.notebook_path) : null;
    default:
      return null;
  }
}

/* ── Diff rendering (for file_edit results) ───────────────────────── */

function DiffBlock({
  text,
  theme,
}: {
  text: string;
  theme: Theme;
}): JSX.Element {
  const lines = text.split("\n");
  return (
    <Box flexDirection="column">
      {lines.map((line, i) => {
        let color: string | undefined;
        if (line.startsWith("+")) color = theme.success;
        else if (line.startsWith("-")) color = theme.danger;
        else if (line.startsWith("@")) color = theme.info;
        return (
          <Text key={i} color={color}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}

/* ── Bash output rendering ────────────────────────────────────────── */

function BashResult({
  text,
  theme,
}: {
  text: string;
  theme: Theme;
}): JSX.Element {
  const exitCodeMatch = text.match(/^Exit code:\s*(\d+)/m);
  const exitCode = exitCodeMatch ? Number(exitCodeMatch[1]) : null;
  const outputStart = text.indexOf("\n");
  const output = outputStart >= 0 ? text.slice(outputStart + 1).trim() : text;

  return (
    <Box flexDirection="column">
      {exitCode !== null && (
        <Text color={exitCode === 0 ? theme.success : theme.danger}>
          exit {exitCode}
        </Text>
      )}
      {output && <Text>{output}</Text>}
    </Box>
  );
}

/* ── Glob / file list rendering ───────────────────────────────────── */

function FileListResult({
  text,
  theme,
}: {
  text: string;
  theme: Theme;
}): JSX.Element {
  const lines = text.split("\n").filter(Boolean);
  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i} color={theme.muted}>
          {line}
        </Text>
      ))}
    </Box>
  );
}

/* ── Write result ─────────────────────────────────────────────────── */

function WriteResult({
  text,
  theme,
}: {
  text: string;
  theme: Theme;
}): JSX.Element {
  return <Text color={theme.success}>{text}</Text>;
}

/* ── Tool-specific result renderer ────────────────────────────────── */

function ToolResult({
  name,
  text,
  theme,
}: {
  name: string;
  text: string;
  theme: Theme;
}): JSX.Element {
  switch (name) {
    case "file_edit":
      if (text.includes("---") || text.includes("+++") || text.includes("@@"))
        return <DiffBlock text={text} theme={theme} />;
      break;
    case "bash":
    case "shell_execute":
      return <BashResult text={text} theme={theme} />;
    case "glob":
      return <FileListResult text={text} theme={theme} />;
    case "file_write":
      return <WriteResult text={text} theme={theme} />;
    default:
      break;
  }
  return <Text>{text}</Text>;
}

/* ── Collapsible wrapper ──────────────────────────────────────────── */

function CollapsibleResult({
  name,
  text,
  theme,
  focused,
}: {
  name: string;
  text: string;
  theme: Theme;
  focused?: boolean;
}): JSX.Element {
  const lines = text.split("\n");
  const isLong = lines.length > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(!isLong);

  useInput(
    (_input, key) => {
      if (key.tab) setExpanded((prev) => !prev);
    },
    { isActive: !!focused && isLong },
  );

  if (!isLong || expanded) {
    return (
      <Box flexDirection="column">
        <ToolResult name={name} text={text} theme={theme} />
        {isLong && (
          <Text color={theme.muted} italic>
            ({lines.length} lines – Tab to collapse)
          </Text>
        )}
      </Box>
    );
  }

  const preview = lines.slice(0, MAX_PREVIEW_LINES).join("\n");
  const hiddenCount = lines.length - MAX_PREVIEW_LINES;

  return (
    <Box flexDirection="column">
      <ToolResult name={name} text={preview} theme={theme} />
      <Text color={theme.muted} italic>
        … {hiddenCount} more lines (Tab to expand)
      </Text>
    </Box>
  );
}

/* ── Main component ───────────────────────────────────────────────── */

export function ToolCallView({
  theme,
  name,
  argsPreview,
  toolArgs,
  status,
  durationMs,
  resultPreview,
  errorMessage,
  focused,
}: ToolCallViewProps): JSX.Element {
  const durationLabel =
    durationMs != null ? `${durationMs.toFixed(0)}ms` : undefined;

  const icon = toolIcon(name);
  const summary = toolArgsSummary(name, toolArgs);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        {status === "running" ? (
          <Spinner theme={theme} label={`${icon} ${name}`} />
        ) : status === "error" ? (
          <Text color={theme.danger}>
            ✗ {icon} {name}
            {durationLabel ? ` (${durationLabel})` : ""}
          </Text>
        ) : (
          <Text color={theme.success}>
            ✓ {icon} {name}
            {durationLabel ? ` (${durationLabel})` : ""}
          </Text>
        )}
      </Box>
      <Box marginLeft={2} flexDirection="column">
        {summary ? (
          <Text color={theme.muted}>{summary}</Text>
        ) : (
          <Text color={theme.muted}>
            {argsPreview.length > 200
              ? `${argsPreview.slice(0, 200)}…`
              : argsPreview}
          </Text>
        )}
        {status === "error" && errorMessage && (
          <Text color={theme.danger}>error: {errorMessage}</Text>
        )}
        {resultPreview && status !== "running" && (
          <CollapsibleResult
            name={name}
            text={resultPreview}
            theme={theme}
            focused={focused}
          />
        )}
      </Box>
    </Box>
  );
}


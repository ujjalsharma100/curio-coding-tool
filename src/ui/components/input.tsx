import React, { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Theme } from "../theme.js";
import { getSlashCommandCompletions } from "../../cli/commands/slash-commands.js";

export interface InputProps {
  readonly theme: Theme;
  readonly disabled?: boolean;
  readonly onSubmit: (value: string) => void;
  readonly persistedHistory?: string[];
  readonly onChange?: (value: string) => void;
  readonly termWidth: number;
  /** When command menu is open, Up/Down/Tab/Enter/Escape are intercepted */
  readonly commandMenuOpen?: boolean;
  readonly onCommandMenuNav?: (delta: number) => void;
  readonly onCommandMenuSelect?: () => void;
  readonly onCommandMenuDismiss?: () => void;
  /** Increment to clear the input (e.g. when parent sends a message from command menu) */
  readonly clearTrigger?: number;
}

export function Input({
  theme,
  disabled,
  onSubmit,
  persistedHistory,
  onChange,
  termWidth,
  commandMenuOpen,
  onCommandMenuNav,
  onCommandMenuSelect,
  onCommandMenuDismiss,
  clearTrigger,
}: InputProps): JSX.Element {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [, setHistoryIndex] = useState<number | null>(null);

  // Clear input whenever parent signals (e.g. message sent from command menu or after submit)
  useEffect(() => {
    if (clearTrigger !== undefined && clearTrigger > 0) {
      setValue("");
      setHistoryIndex(null);
    }
  }, [clearTrigger]);

  useEffect(() => {
    if (persistedHistory && persistedHistory.length > 0) {
      setHistory((prev) => {
        const combined = [...persistedHistory];
        for (const item of prev) {
          if (!combined.includes(item)) {
            combined.push(item);
          }
        }
        return combined;
      });
    }
  }, [persistedHistory]);

  // Sync value to parent only in effect so we never update App during Input's render/commit
  useEffect(() => {
    onChange?.(value);
  }, [value, onChange]);

  const updateValue = useCallback((newVal: string) => {
    setValue(newVal);
  }, []);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    // Clear immediately so the next prompt shows an empty input
    setValue("");
    setHistoryIndex(null);
    setHistory((prev) => [...prev, trimmed]);
    onSubmit(trimmed);
  }, [onSubmit, value]);

  useInput(
    (input, key) => {
      if (disabled) return;

      // When command menu is open, intercept nav keys
      if (commandMenuOpen) {
        if (key.upArrow) { onCommandMenuNav?.(-1); return; }
        if (key.downArrow) { onCommandMenuNav?.(1); return; }
        if (key.return || key.tab) { onCommandMenuSelect?.(); return; }
        if (key.escape) { onCommandMenuDismiss?.(); return; }
        // Let typing continue through to filter
        if (key.backspace || key.delete) {
          setValue((prev) => prev.slice(0, -1));
          return;
        }
        if (input) {
          setValue((prev) => prev + input);
          return;
        }
        return;
      }

      if (key.return) { submit(); return; }

      if (key.upArrow) {
        setHistoryIndex((idx) => {
          if (history.length === 0) return null;
          const next = idx == null ? history.length - 1 : Math.max(0, idx - 1);
          const val = history[next] ?? "";
          setValue(val);
          return next;
        });
        return;
      }

      if (key.downArrow) {
        setHistoryIndex((idx) => {
          if (history.length === 0) return null;
          if (idx == null) return null;
          const next = idx + 1;
          if (next >= history.length) {
            setValue("");
            return null;
          }
          const val = history[next] ?? "";
          setValue(val);
          return next;
        });
        return;
      }

      if (key.escape) { updateValue(""); setHistoryIndex(null); return; }

      if (key.backspace || key.delete) {
        setValue((prev) => prev.slice(0, -1));
        return;
      }

      if (key.tab) {
        if (value.startsWith("/")) {
          const completions = getSlashCommandCompletions(value);
          if (completions.length === 1) {
            updateValue(completions[0]! + " ");
          }
        }
        return;
      }

      if (input) {
        setValue((prev) => prev + input);
      }
    },
    { isActive: !disabled },
  );

  // Always show ">" so the first character is never obscured by a "..." prompt
  const promptChar = ">";
  const promptColor = disabled ? theme.muted : theme.accent;
  const borderColor = disabled ? theme.dim : theme.inputBorder;
  const cursorChar = disabled ? "" : "\u258C";
  // Single text node: no truncation (so no "…" on first key), cursor stays on same line
  const valueWithCursor = value + cursorChar;

  return (
    <Box flexDirection="column" width={termWidth}>
      <Box borderStyle="round" borderColor={borderColor} paddingX={1} width={termWidth} flexDirection="row">
        <Text color={promptColor} bold>{promptChar} </Text>
        <Text>
          {valueWithCursor}
        </Text>
      </Box>
      <Box paddingX={1}>
        <Text color={theme.dim} wrap="truncate-end">
          Enter send · Up/Down history · /commands · !shell · @file · /keys
        </Text>
      </Box>
    </Box>
  );
}

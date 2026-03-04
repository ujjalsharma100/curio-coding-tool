import React, { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Theme } from "../theme.js";

export interface InputProps {
  readonly theme: Theme;
  readonly disabled?: boolean;
  readonly onSubmit: (value: string) => void;
  readonly persistedHistory?: string[];
}

/**
 * Simple input component:
 *
 * - Enter submits.
 * - Up/Down arrow keys move the cursor through the local + persisted history buffer.
 */
export function Input({
  theme,
  disabled,
  onSubmit,
  persistedHistory,
}: InputProps): JSX.Element {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [, setHistoryIndex] = useState<number | null>(null);

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

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(null);
    setValue("");
  }, [onSubmit, value]);

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return) {
        submit();
        return;
      }

      if (key.upArrow) {
        setHistoryIndex((idx) => {
          if (history.length === 0) return null;
          const next = idx == null ? history.length - 1 : Math.max(0, idx - 1);
          setValue(history[next] ?? "");
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
          setValue(history[next] ?? "");
          return next;
        });
        return;
      }

      if (key.backspace || key.delete) {
        setValue((prev) => prev.slice(0, -1));
        return;
      }

      if (input) {
        setValue((prev) => prev + input);
      }
    },
    { isActive: !disabled },
  );

  const promptChar = disabled ? "…" : "❯";
  const cursorChar = disabled ? "" : "▌";

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.accentSoft}>{promptChar} </Text>
        <Text>
          {value}
          {cursorChar}
        </Text>
      </Box>
      <Box marginTop={0}>
        <Text color={theme.muted}>
          Enter to send · Ctrl+C to interrupt
        </Text>
      </Box>
    </Box>
  );
}

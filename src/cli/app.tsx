import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import type { Agent, StreamEvent } from "curio-agent-sdk";
import { getActiveTheme } from "../ui/theme.js";
import { StatusBar } from "../ui/components/status-bar.js";
import { Message, type MessageRole } from "../ui/components/message.js";
import { ToolCallView } from "../ui/components/tool-call.js";
import { Input } from "../ui/components/input.js";
import { Spinner } from "../ui/components/spinner.js";
import { Notification, type NotificationItem } from "../ui/components/notification.js";

interface AppProps {
  readonly agent: Agent;
  readonly modelDisplayName: string;
  readonly providerDisplayName: string;
  readonly contextBudgetLabel?: string;
}

interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
}

interface ToolCallState {
  id: string;
  name: string;
  argsPreview: string;
  toolArgs?: Record<string, unknown>;
  status: "running" | "completed" | "error";
  durationMs?: number;
  resultPreview?: string;
  errorMessage?: string;
}

let nextId = 1;
const genId = () => String(nextId++);

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg)$/i;
const COMPACT_WIDTH = 80;

function detectImagePaths(input: string): string[] {
  const words = input.split(/\s+/);
  return words.filter((w) => IMAGE_EXTENSIONS.test(w));
}

/* ── Elapsed time spinner for the "thinking" phase ────────────────── */

function ThinkingIndicator({ theme }: { theme: ReturnType<typeof getActiveTheme> }): JSX.Element {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Box>
      <Spinner theme={theme} label={`Thinking… ${elapsed}s`} />
    </Box>
  );
}

export function App({
  agent,
  modelDisplayName,
  providerDisplayName,
  contextBudgetLabel,
}: AppProps): JSX.Element {
  const theme = getActiveTheme();
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallState[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasFirstToken, setHasFirstToken] = useState(false);
  const [lastPromptTokens, setLastPromptTokens] = useState<number | undefined>(
    undefined,
  );
  const [lastCompletionTokens, setLastCompletionTokens] = useState<
    number | undefined
  >(undefined);
  const [lastDurationMs, setLastDurationMs] = useState<number | undefined>(
    undefined,
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const currentStreamRef = useRef<AsyncIterableIterator<StreamEvent> | null>(
    null,
  );
  const interruptedRef = useRef(false);

  const termWidth = stdout?.columns ?? 120;
  const isCompact = termWidth < COMPACT_WIDTH;

  const pushNotification = useCallback(
    (level: NotificationItem["level"], text: string) => {
      const id = genId();
      setNotifications((prev) => [...prev, { id, level, text }]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 5000);
    },
    [],
  );

  const handleStreamEvent = useCallback(
    (event: StreamEvent, assistantId: string) => {
      switch (event.type) {
        case "text_delta": {
          setHasFirstToken(true);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: (m.content ?? "") + event.text }
                : m,
            ),
          );
          break;
        }
        case "tool_call_start": {
          setHasFirstToken(true);
          const rawArgs =
            typeof event.toolInput === "string"
              ? event.toolInput
              : JSON.stringify(event.toolInput, null, 2);
          const parsedArgs =
            typeof event.toolInput === "object" && event.toolInput !== null
              ? (event.toolInput as Record<string, unknown>)
              : undefined;
          setToolCalls((prev) => [
            ...prev,
            {
              id: event.callId ?? genId(),
              name: event.toolName,
              argsPreview: rawArgs,
              toolArgs: parsedArgs,
              status: "running",
            },
          ]);
          break;
        }
        case "tool_call_end": {
          const maxResult = 2000;
          const preview =
            event.result.length > maxResult
              ? `${event.result.slice(0, maxResult)}…`
              : event.result;
          setToolCalls((prev) =>
            prev.map((call) =>
              call.id === (event.callId ?? call.id)
                ? {
                    ...call,
                    status: event.error ? "error" : "completed",
                    durationMs: event.duration,
                    resultPreview: preview,
                    errorMessage: event.error ?? undefined,
                  }
                : call,
            ),
          );
          break;
        }
        case "thinking": {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: `${m.content}\n\n> ${event.text}`,
                  }
                : m,
            ),
          );
          break;
        }
        case "error": {
          pushNotification("error", event.error.message);
          setMessages((prev) => [
            ...prev,
            {
              id: genId(),
              role: "assistant",
              content: `Error: ${event.error.message}`,
            },
          ]);
          break;
        }
        case "done": {
          setLastPromptTokens(event.result.usage.promptTokens);
          setLastCompletionTokens(event.result.usage.completionTokens);
          setLastDurationMs(event.duration);
          break;
        }
        case "iteration_start":
        case "iteration_end":
          break;
      }
    },
    [pushNotification],
  );

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isStreaming) return;

      const imagePaths = detectImagePaths(input);
      if (imagePaths.length > 0) {
        pushNotification(
          "info",
          `Detected image${imagePaths.length > 1 ? "s" : ""}: ${imagePaths.join(", ")}`,
        );
      }

      const userId = genId();
      const assistantId = genId();

      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: input },
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setToolCalls([]);
      setIsStreaming(true);
      setHasFirstToken(false);
      interruptedRef.current = false;

      try {
        const stream = agent.astream(input);
        currentStreamRef.current = stream;

        for await (const event of stream) {
          if (interruptedRef.current) {
            break;
          }
          handleStreamEvent(event, assistantId);
        }
      } catch (err) {
        if (interruptedRef.current) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        pushNotification("error", message);
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: "assistant",
            content: `Error while generating response: ${message}`,
          },
        ]);
      } finally {
        setIsStreaming(false);
        setHasFirstToken(false);
        interruptedRef.current = false;
        currentStreamRef.current = null;
      }
    },
    [agent, handleStreamEvent, isStreaming, pushNotification],
  );

  useInput((input, key) => {
    if (key.ctrl && (input === "c" || input === "C")) {
      if (isStreaming) {
        interruptedRef.current = true;
        currentStreamRef.current?.return?.(undefined);
        pushNotification("warning", "Generation interrupted.");
        setIsStreaming(false);
        setHasFirstToken(false);
      } else {
        pushNotification("info", "Use Ctrl+D to close the terminal.");
      }
      return;
    }

    if (key.ctrl && (input === "d" || input === "D")) {
      exit();
    }
  }, { isActive: true });

  return (
    <Box flexDirection="column" height="100%">
      {!isCompact && (
        <StatusBar
          theme={theme}
          modelDisplayName={modelDisplayName}
          providerDisplayName={providerDisplayName}
          totalPromptTokens={lastPromptTokens}
          totalCompletionTokens={lastCompletionTokens}
          lastDurationMs={lastDurationMs}
          contextBudgetLabel={contextBudgetLabel}
        />
      )}
      {notifications.length > 0 && (
        <Box flexDirection="column" marginTop={isCompact ? 0 : 1}>
          {notifications.map((n) => (
            <Notification key={n.id} item={n} theme={theme} />
          ))}
        </Box>
      )}
      <Box flexDirection="column" flexGrow={1} marginTop={1}>
        {messages.length === 0 && (
          <Box marginBottom={1}>
            <Text color={theme.muted}>
              {isCompact
                ? 'Type a coding task. e.g. "explain this file"'
                : 'Ask Curio Code to help you with a coding task. For example: "Explain this file" or "Add logging to this function".'}
            </Text>
          </Box>
        )}
        {messages.map((m) => (
          <Message
            key={m.id}
            id={m.id}
            role={m.role}
            content={m.content}
            theme={theme}
          />
        ))}
        {isStreaming && !hasFirstToken && (
          <ThinkingIndicator theme={theme} />
        )}
        {toolCalls.map((call) => (
          <ToolCallView
            key={call.id}
            theme={theme}
            name={call.name}
            argsPreview={call.argsPreview}
            toolArgs={call.toolArgs}
            status={call.status}
            durationMs={call.durationMs}
            resultPreview={call.resultPreview}
            errorMessage={call.errorMessage}
          />
        ))}
      </Box>
      <Box marginTop={1}>
        <Input theme={theme} disabled={isStreaming} onSubmit={sendMessage} />
      </Box>
      {!isCompact && (
        <Box marginTop={1}>
          <Text color={theme.muted}>Press Ctrl+D to close the terminal.</Text>
        </Box>
      )}
    </Box>
  );
}


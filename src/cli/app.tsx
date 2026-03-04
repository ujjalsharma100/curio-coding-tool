import React, { useCallback, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { Agent, StreamEvent } from "curio-agent-sdk";
import { getActiveTheme } from "../ui/theme.js";
import { StatusBar } from "../ui/components/status-bar.js";
import { Message, type MessageRole } from "../ui/components/message.js";
import { ToolCallView } from "../ui/components/tool-call.js";
import { Input } from "../ui/components/input.js";

interface AppProps {
  readonly agent: Agent;
  readonly modelDisplayName: string;
  readonly providerDisplayName: string;
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
  status: "running" | "completed" | "error";
  durationMs?: number;
  resultPreview?: string;
  errorMessage?: string;
}

let nextId = 1;
const genId = () => String(nextId++);

export function App({
  agent,
  modelDisplayName,
  providerDisplayName,
}: AppProps): JSX.Element {
  const theme = getActiveTheme();
  const { exit } = useApp();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallState[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastPromptTokens, setLastPromptTokens] = useState<number | undefined>(
    undefined,
  );
  const [lastCompletionTokens, setLastCompletionTokens] = useState<
    number | undefined
  >(undefined);
  const [lastDurationMs, setLastDurationMs] = useState<number | undefined>(
    undefined,
  );

  const handleStreamEvent = useCallback((event: StreamEvent, assistantId: string) => {
    switch (event.type) {
      case "text_delta": {
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
        const argsPreview =
          typeof event.toolInput === "string"
            ? event.toolInput
            : JSON.stringify(event.toolInput, null, 2);
        setToolCalls((prev) => [
          ...prev,
          {
            id: event.callId ?? genId(),
            name: event.toolName,
            argsPreview,
            status: "running",
          },
        ]);
        break;
      }
      case "tool_call_end": {
        const preview =
          event.result.length > 400
            ? `${event.result.slice(0, 400)}…`
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
        // Iteration events are currently not rendered explicitly; the tool-call
        // stream and markdown output provide enough feedback for Phase 3.
        break;
    }
  }, []);

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isStreaming) return;

      const userId = genId();
      const assistantId = genId();

      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: input },
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setToolCalls([]);
      setIsStreaming(true);

      try {
        for await (const event of agent.astream(input)) {
          handleStreamEvent(event, assistantId);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
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
      }
    },
    [agent, handleStreamEvent, isStreaming],
  );

  // Allow Ctrl+D to exit the application gracefully from anywhere.
  useInput((input, key) => {
    if (key.ctrl && (input === "d" || input === "D")) {
      exit();
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar
        theme={theme}
        modelDisplayName={modelDisplayName}
        providerDisplayName={providerDisplayName}
        totalPromptTokens={lastPromptTokens}
        totalCompletionTokens={lastCompletionTokens}
        lastDurationMs={lastDurationMs}
      />
      <Box flexDirection="column" flexGrow={1} marginTop={1}>
        {messages.length === 0 && (
          <Box marginBottom={1}>
            <Text color={theme.muted}>
              Ask Curio Code to help you with a coding task. For example:
              {" "}
              "Explain this file" or "Add logging to this function".
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
        {toolCalls.map((call) => (
          <ToolCallView
            key={call.id}
            theme={theme}
            name={call.name}
            argsPreview={call.argsPreview}
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
      <Box marginTop={1}>
        <Text color={theme.muted}>Press Ctrl+D to close the terminal.</Text>
      </Box>
    </Box>
  );
}


import readline from "node:readline";
import type { Agent } from "curio-agent-sdk";
import type { StreamEvent } from "curio-agent-sdk";

/**
 * Run the interactive REPL: prompt → stream → repeat.
 *
 * - Empty input is ignored (re-prompts immediately).
 * - Ctrl+C during generation interrupts the current stream.
 * - Ctrl+C when idle shows a hint to use Ctrl+D.
 * - Ctrl+D (EOF) exits gracefully.
 */
export async function runInteractiveRepl(agent: Agent): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let streaming = false;
  let interrupted = false;
  let currentStream: AsyncIterableIterator<StreamEvent> | null = null;

  rl.on("SIGINT", () => {
    if (streaming) {
      interrupted = true;
      // Force-close the iterator so the inner loop exits promptly.
      currentStream?.return?.(undefined);
      process.stdout.write("\n(generation interrupted)\n");
    } else {
      process.stdout.write("\n(Use Ctrl+D to exit)\n");
      rl.prompt();
    }
  });

  rl.on("close", () => {
    process.stdout.write("\nGoodbye.\n");
  });

  rl.setPrompt("❯ ");
  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();

    if (input.length === 0) {
      rl.prompt();
      continue;
    }

    streaming = true;
    interrupted = false;

    try {
      currentStream = agent.astream(input);
      for await (const event of currentStream) {
        if (interrupted) break;
        renderStreamEvent(event);
      }
    } catch (err) {
      if (!interrupted) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`\nError: ${message}\n`);
      }
    } finally {
      streaming = false;
      interrupted = false;
      currentStream = null;
    }

    process.stdout.write("\n");
    rl.prompt();
  }
}

/**
 * Run a single prompt (one-shot), stream the response, then exit.
 *
 * When `printOnly` is true (`--print` flag), only raw text is emitted to
 * stdout — no banners, tool calls, or metrics — so the output can be
 * piped cleanly.
 */
export async function runOneShotMode(
  agent: Agent,
  prompt: string,
  printOnly: boolean,
): Promise<void> {
  try {
    for await (const event of agent.astream(prompt)) {
      if (printOnly) {
        if (event.type === "text_delta") {
          process.stdout.write(event.text);
        }
      } else {
        renderStreamEvent(event);
      }
    }
    process.stdout.write("\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }
}

function renderStreamEvent(event: StreamEvent): void {
  switch (event.type) {
    case "text_delta":
      process.stdout.write(event.text);
      break;

    case "tool_call_start":
      process.stdout.write(`\n> Calling tool: ${event.toolName}\n`);
      break;

    case "tool_call_end":
      if (event.error) {
        process.stderr.write(`  x Error: ${event.error}\n`);
      } else {
        const preview =
          event.result.length > 200
            ? event.result.slice(0, 200) + "..."
            : event.result;
        process.stdout.write(`  Done (${event.duration}ms): ${preview}\n`);
      }
      break;

    case "thinking":
      process.stdout.write(`[thinking] ${event.text}\n`);
      break;

    case "error":
      process.stderr.write(`Error: ${event.error.message}\n`);
      break;

    case "done": {
      const { usage, duration, iterations } = event.result;
      process.stderr.write(
        `\n--- Tokens: ${usage.promptTokens} in / ${usage.completionTokens} out` +
          ` | Duration: ${(duration / 1000).toFixed(1)}s` +
          ` | Turns: ${iterations}\n`,
      );
      break;
    }

    case "iteration_start":
    case "iteration_end":
      // Not rendered in Phase 1; full UI in Phase 3.
      break;
  }
}

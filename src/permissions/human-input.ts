import { createInterface } from "node:readline";
import type { HumanInputHandler } from "curio-agent-sdk";

/**
 * CLI-based human input handler for non-interactive (one-shot) mode.
 * Uses simple readline-based y/n prompts to stderr so stdout stays
 * clean for piped output.
 */
export class CliPermissionHandler implements HumanInputHandler {
  private readonly alwaysAllowed = new Set<string>();
  private readonly timeoutMs: number | null;

  constructor(options?: { timeoutMs?: number }) {
    this.timeoutMs = options?.timeoutMs ?? null;
  }

  async getUserConfirmation(
    prompt: string,
    context?: Record<string, unknown>,
  ): Promise<boolean> {
    const toolName = typeof context?.toolName === "string" ? context.toolName : undefined;
    if (toolName && this.alwaysAllowed.has(toolName)) {
      return true;
    }

    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stderr,
      });

      let timer: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        rl.close();
      };

      process.stderr.write(`\n${prompt}\n`);
      rl.question("[y]es / [n]o / [a]lways allow: ", (answer) => {
        cleanup();
        const key = answer.trim().toLowerCase();
        if (key === "a" || key === "always") {
          if (toolName) this.alwaysAllowed.add(toolName);
          resolve(true);
        } else {
          resolve(key === "y" || key === "yes");
        }
      });

      if (this.timeoutMs !== null) {
        timer = setTimeout(() => {
          process.stderr.write("\nPermission request timed out — denying.\n");
          cleanup();
          resolve(false);
        }, this.timeoutMs);
      }
    });
  }

  markAlwaysAllowed(toolName: string): void {
    this.alwaysAllowed.add(toolName);
  }
}

/**
 * Headless handler that auto-allows everything (for auto mode or testing).
 */
export class AutoAllowHandler implements HumanInputHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getUserConfirmation(prompt: string, context?: Record<string, unknown>): Promise<boolean> {
    return true;
  }
}

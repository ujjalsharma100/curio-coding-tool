import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { buildAgent } from "../agent/builder.js";
import { runOneShotMode } from "./repl.js";

type PermissionMode = "ask" | "auto" | "strict";

interface RawOptions {
  model?: string;
  provider?: string;
  print?: boolean;
  verbose?: boolean;
  permissionMode?: PermissionMode;
  memory?: boolean;
  maxTurns?: number;
  resume?: string;
  continue?: boolean;
}

export interface CliRuntimeConfig {
  prompt?: string;
  stdinInput?: string;
  interactive: boolean;
  print: boolean;
  model?: string;
  provider?: string;
  permissionMode?: PermissionMode;
  continueLastSession: boolean;
  resumeSessionId?: string;
  verbose: boolean;
  memoryEnabled: boolean;
  maxTurns?: number;
}

const VERSION = "0.0.0";

async function readAllStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("error", (err) => {
      reject(err);
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
  });
}

function setupSignalHandlers(): void {
  process.on("SIGTERM", () => {
    process.stderr.write("\nReceived SIGTERM. Shutting down Curio Code.\n");
    process.exit(0);
  });

  process.on("SIGHUP", () => {
    process.stderr.write(
      "\nTerminal closed (SIGHUP). Saving state and exiting.\n",
    );
    process.exit(0);
  });
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  setupSignalHandlers();

  const program = new Command();

  program
    .name("curio-code")
    .description("Curio Code — terminal-based AI coding assistant.")
    .version(VERSION)
    .argument(
      "[prompt...]",
      'Prompt to send in one-shot mode, e.g. `curio-code "explain this"`',
    )
    .option(
      "--model <model>",
      "Model to use, e.g. anthropic:claude-sonnet-4-6 or short alias like sonnet",
    )
    .option("--provider <provider>", "LLM provider override")
    .option(
      "--print",
      "Non-interactive mode: plain stdout output only (no TUI chrome)",
    )
    .option("-c, --continue", "Resume last session")
    .option("--resume <session-id>", "Resume a specific session by ID")
    .option("-v, --verbose", "Enable debug logging")
    .option(
      "--permission-mode <mode>",
      "Permission mode: ask | auto | strict",
    )
    .option("--no-memory", "Disable persistent memory for this run")
    .option(
      "--max-turns <n>",
      "Maximum agent turns for this run (for safety)",
      (value: string) => Number.parseInt(value, 10),
    );

  program
    .command("init")
    .description("Initialize project configuration for Curio Code.")
    .action(() => {
      process.stdout.write(
        "curio-code init: project initialization will be implemented in a later phase.\n",
      );
    });

  program
    .command("config")
    .description("Show or edit Curio Code configuration.")
    .action(() => {
      process.stdout.write(
        "curio-code config: configuration management will be implemented in a later phase.\n",
      );
    });

  program
    .command("update")
    .description("Check for and apply updates to Curio Code.")
    .action(() => {
      process.stdout.write(
        "curio-code update: self-update workflow will be implemented in a later phase.\n",
      );
    });

  program.action(async (promptWords: string[]) => {
    const rawOptions = program.opts<RawOptions>();

    const promptFromArgs =
      promptWords && promptWords.length > 0
        ? promptWords.join(" ").trim()
        : undefined;

    let stdinInput: string | undefined;
    const stdinIsTty = !!process.stdin.isTTY;

    if (!stdinIsTty) {
      const data = await readAllStdin();
      if (data.trim().length > 0) {
        stdinInput = data;
      }
    }

    let combinedPrompt = promptFromArgs;
    if (stdinInput && promptFromArgs) {
      combinedPrompt = `${promptFromArgs}\n\n${stdinInput}`;
    } else if (!promptFromArgs && stdinInput) {
      combinedPrompt = stdinInput;
    }

    const stdoutIsTty = !!process.stdout.isTTY;
    const interactive =
      stdoutIsTty && !rawOptions.print && !combinedPrompt && stdinIsTty;

    const runtimeConfig: CliRuntimeConfig = {
      prompt: combinedPrompt,
      stdinInput,
      interactive,
      print: !!rawOptions.print,
      model: rawOptions.model,
      provider: rawOptions.provider,
      permissionMode: rawOptions.permissionMode,
      continueLastSession: !!rawOptions["continue"],
      resumeSessionId: rawOptions.resume,
      verbose: !!rawOptions.verbose,
      memoryEnabled: rawOptions.memory !== false,
      maxTurns: rawOptions.maxTurns,
    };

    let agentResult;
    try {
      agentResult = await buildAgent(runtimeConfig);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    }

    const { agent, modelDisplayName, providerDisplayName } = agentResult;

    try {
      if (runtimeConfig.interactive) {
        const { App } = await import("./app.js");
        const inkApp = render(
          React.createElement(App, {
            agent,
            modelDisplayName,
            providerDisplayName,
          }),
          {
            // Let the app handle Ctrl+C so we can interrupt active generation
            // instead of immediately exiting the process.
            exitOnCtrlC: false,
          },
        );
        await inkApp.waitUntilExit();
      } else if (runtimeConfig.prompt) {
        if (!runtimeConfig.print) {
          process.stderr.write(
            `Curio Code v${VERSION} · ${modelDisplayName} (${providerDisplayName})\n`,
          );
        }
        await runOneShotMode(agent, runtimeConfig.prompt, runtimeConfig.print);
      } else {
        process.stderr.write(
          "No prompt provided. Run in a TTY for interactive mode, or provide a prompt.\n",
        );
        process.exit(1);
      }
    } finally {
      await agent.close();
      process.exit(0);
    }
  });

  await program.parseAsync(argv);
}

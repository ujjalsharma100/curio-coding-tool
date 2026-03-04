import { createTool } from "curio-agent-sdk";
import { z } from "zod";

async function main() {
  const echoTool = createTool({
    name: "echo",
    description: "Echo back a provided message.",
    parameters: z.object({
      message: z.string().describe("The message to echo back")
    }),
    execute: async ({ message }: { message: string }) => {
      return { message };
    }
  });

  // Phase 0: we just prove we can import and construct SDK tools.
  // Full Agent wiring, provider configuration, and REPL loop come in later phases.
  console.log("Curio Code Phase 0 initialized with SDK tool:", echoTool.name);
}

void main();

export {};

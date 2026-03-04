import { describe, expect, it } from "vitest";
import { Agent, AgentBuilder, createTool } from "curio-agent-sdk";
import { MockLLM } from "curio-agent-sdk/testing";
import { z } from "zod";

describe("curio-agent-sdk integration (Phase 0)", () => {
  it("can construct an Agent and run a simple turn", async () => {
    const echoTool = createTool({
      name: "echo",
      description: "Echo back a provided message.",
      parameters: z.object({
        message: z.string()
      }),
      execute: async ({ message }) => {
        return { message };
      }
    });

    const mock = new MockLLM();
    mock.addTextResponse("ok");

    const agent: Agent = new AgentBuilder()
      .llmClient(mock)
      .tools([echoTool])
      .build();

    const result = await agent.run("test");
    expect(result.output).toBeDefined();
  });
});


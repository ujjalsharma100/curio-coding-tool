import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../../src/agent/system-prompt.js";

describe("Phase 1 system prompt", () => {
  it("includes required environment and placeholder sections", () => {
    const prompt = buildSystemPrompt({ cwd: "/tmp/project" });

    expect(prompt).toContain("You are Curio Code");
    expect(prompt).toContain("## Environment");
    expect(prompt).toContain("Working Directory: /tmp/project");
    expect(prompt).toContain("## Tool Usage");
    expect(prompt).toContain("## Project Context");
    expect(prompt).toContain("## Git Context");
    expect(prompt).toContain("## Custom Instructions");
    expect(prompt).toContain("## Memory");
  });
});


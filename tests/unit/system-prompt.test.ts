import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../../src/agent/system-prompt.js";

describe("Phase 4 system prompt", () => {
  it("includes environment, project, git, and instruction sections", async () => {
    const prompt = await buildSystemPrompt({ cwd: "/tmp/project" });

    expect(prompt).toContain("You are Curio Code");
    expect(prompt).toContain("## Environment");
    expect(prompt).toContain("Available Tools");
    expect(prompt).toContain("Available Runtimes");
    expect(prompt).toContain("Working Directory: /tmp/project");
    expect(prompt).toContain("## Tool Usage");
    expect(prompt).toContain("## Project Context");
    expect(prompt).toContain("## Git Context");
    expect(prompt).toContain("## .gitignore Patterns");
    expect(prompt).toContain("## Custom Instructions");
    expect(prompt).toContain("## Memory");
  });
});


import path from "node:path";
import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { detectProjectContext } from "../../src/context/project-detector.js";
import {
  detectGitContext,
  formatGitContextForPrompt,
} from "../../src/context/git-context.js";
import { loadCurioInstructions } from "../../src/context/instruction-loader.js";
import {
  buildContextWindowRuntime,
  buildContextBudgetLabel,
} from "../../src/context/context-window.js";
import {
  detectEnvironmentContext,
  formatEnvironmentContextForPrompt,
} from "../../src/context/environment.js";

describe("Phase 4 context intelligence", () => {
  it("detects project context from marker files", async () => {
    const context = await detectProjectContext(process.cwd());
    expect(context.projectRoot.length).toBeGreaterThan(1);
    expect(context.language).toContain("Node.js");
    expect(context.packageManager).toBeDefined();
  });

  it("detects git context and formats prompt section", async () => {
    const context = await detectGitContext(process.cwd());
    expect(context.isGitRepository).toBe(true);
    const formatted = formatGitContextForPrompt(context);
    expect(formatted).toContain("Branch");
    expect(formatted).toContain("Status");
  });

  it("loads CURIO.md hierarchy and respects .curioignore", async () => {
    const tempRoot = path.join(
      process.cwd(),
      "tests",
      "tmp-phase4-instructions",
    );
    const nested = path.join(tempRoot, "a", "b");
    await fs.mkdir(path.join(tempRoot, ".curio-code"), { recursive: true });
    await fs.mkdir(nested, { recursive: true });
    await fs.writeFile(path.join(tempRoot, "package.json"), "{}", "utf8");
    await fs.writeFile(path.join(tempRoot, "CURIO.md"), "root instructions", "utf8");
    await fs.writeFile(
      path.join(tempRoot, ".curio-code", "rules.md"),
      "rules instructions",
      "utf8",
    );
    await fs.writeFile(path.join(tempRoot, ".curioignore"), ".curio-code/\n", "utf8");

    const loaded = await loadCurioInstructions(nested);
    expect(loaded.merged).toContain("root instructions");
    expect(loaded.files.some((f) => f.endsWith(".curio-code/rules.md"))).toBe(
      false,
    );
  });

  it("builds model-aware context window runtime", () => {
    const runtime = buildContextWindowRuntime("anthropic:claude-sonnet-4-6");
    expect(runtime.config.maxTokens).toBe(200000);
    expect(buildContextBudgetLabel(runtime.config)).toContain("tokens");
  });

  it("detects environment and formats prompt section", () => {
    const env = detectEnvironmentContext(process.cwd());
    const formatted = formatEnvironmentContextForPrompt(env);
    expect(formatted).toContain("Operating System");
    expect(formatted).toContain("Working Directory");
  });
});

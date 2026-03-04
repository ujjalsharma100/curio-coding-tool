import { describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import path from "node:path";
import { globTool } from "../../src/tools/glob.js";

describe("Phase 2 glob tool", () => {
  it("finds files matching pattern in a directory", async () => {
    const tmpDir = path.join(process.cwd(), "tests", "tmp-glob");
    await fs.mkdir(tmpDir, { recursive: true });
    const fileA = path.join(tmpDir, "a.ts");
    const fileB = path.join(tmpDir, "b.ts");
    await fs.writeFile(fileA, "a", "utf8");
    await fs.writeFile(fileB, "b", "utf8");

    const result = await globTool.execute({
      pattern: "*.ts",
      path: tmpDir,
    } as never);

    const lines = String(result).split("\n");
    expect(lines.some((line) => line.endsWith("a.ts"))).toBe(true);
    expect(lines.some((line) => line.endsWith("b.ts"))).toBe(true);
  });
});



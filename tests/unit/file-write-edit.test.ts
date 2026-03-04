import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import * as fs from "node:fs/promises";
import { fileWriteTool } from "../../src/tools/file-write.js";
import { fileEditTool } from "../../src/tools/file-edit.js";
import { toolSessionState } from "../../src/tools/session-state.js";

describe("Phase 2 file write/edit tools", () => {
  const tmpDir = path.join(process.cwd(), "tests", "tmp-file-write-edit");
  const baseFile = path.join(tmpDir, "file.txt");

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("writes content and reports bytes written", async () => {
    await fs.mkdir(tmpDir, { recursive: true });

    const result = await fileWriteTool.execute({
      file_path: baseFile,
      content: "hello",
    } as never);

    expect(result).toContain(`Wrote 5 bytes to ${baseFile}`);
  });

  it("warns when overwriting a file that was not read", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(baseFile, "existing", "utf8");

    const result = await fileWriteTool.execute({
      file_path: baseFile,
      content: "data",
    } as never);

    expect(result).toContain("Warning: overwriting file that was not read first");
  });

  it("does not warn when overwriting a previously read file", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(baseFile, "existing", "utf8");
    toolSessionState.markFileRead(baseFile);

    const result = await fileWriteTool.execute({
      file_path: baseFile,
      content: "data",
    } as never);

    expect(result.startsWith("Warning")).toBe(false);
  });

  it("rejects edits when file was not read first", async () => {
    const unreadFile = path.join(tmpDir, "unread.txt");

    const result = await fileEditTool.execute({
      file_path: unreadFile,
      old_string: "a",
      new_string: "b",
      replace_all: false,
    } as never);

    expect(result).toContain("File must be read before editing");
  });

  it("rejects no-op edits when old and new strings are equal", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(baseFile, "same", "utf8");
    toolSessionState.markFileRead(baseFile);

    const result = await fileEditTool.execute({
      file_path: baseFile,
      old_string: "same",
      new_string: "same",
      replace_all: false,
    } as never);

    expect(result).toContain("No-op edit rejected");
  });

  it("errors when old_string not found", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(baseFile, "foo bar", "utf8");
    toolSessionState.markFileRead(baseFile);

    const result = await fileEditTool.execute({
      file_path: baseFile,
      old_string: "baz",
      new_string: "qux",
      replace_all: false,
    } as never);

    expect(result).toContain("old_string not found in file");
  });

  it("requires uniqueness when replace_all is false", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(baseFile, "x x x", "utf8");
    toolSessionState.markFileRead(baseFile);

    const result = await fileEditTool.execute({
      file_path: baseFile,
      old_string: "x",
      new_string: "y",
      replace_all: false,
    } as never);

    expect(result).toContain("Provide more context to make it unique");
  });

  it("applies replacement and returns a diff", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(baseFile, "before\nTARGET\nafter\n", "utf8");
    toolSessionState.markFileRead(baseFile);

    const result = await fileEditTool.execute({
      file_path: baseFile,
      old_string: "TARGET",
      new_string: "UPDATED",
      replace_all: false,
    } as never);

    expect(result).toContain("Applied edit");
    expect(result).toContain("--- a/");
    expect(result).toContain("+++ b/");
    expect(result).toContain("-TARGET");
    expect(result).toContain("+UPDATED");
  });
});


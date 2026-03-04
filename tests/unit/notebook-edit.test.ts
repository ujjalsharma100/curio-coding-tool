import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import path from "node:path";
import { notebookEditTool } from "../../src/tools/notebook-edit.js";

describe("Phase 2 notebook_edit tool", () => {
  const tmpDir = path.join(process.cwd(), "tests", "tmp-notebook-edit");
  const nbPath = path.join(tmpDir, "notebook.ipynb");

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  function makeNotebook() {
    return {
      cells: [
        {
          id: "cell-1",
          cell_type: "code" as const,
          source: ["print(1)\n"],
          outputs: [],
          execution_count: 1,
        },
      ],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    };
  }

  it("replaces existing cell content by number", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(nbPath, JSON.stringify(makeNotebook()), "utf8");

    const result = await notebookEditTool.execute({
      notebook_path: nbPath,
      cell_number: 0,
      new_source: "print(2)",
      edit_mode: "replace",
    } as never);

    expect(result).toContain("Notebook updated");
    const updated = JSON.parse(await fs.readFile(nbPath, "utf8"));
    expect(updated.cells[0].source.join("")).toContain("print(2)");
  });

  it("inserts a new cell when edit_mode is insert", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(nbPath, JSON.stringify(makeNotebook()), "utf8");

    const result = await notebookEditTool.execute({
      notebook_path: nbPath,
      cell_number: 1,
      new_source: "print(3)",
      edit_mode: "insert",
      cell_type: "code",
    } as never);

    expect(result).toContain("Notebook updated");
    const updated = JSON.parse(await fs.readFile(nbPath, "utf8"));
    expect(updated.cells.length).toBe(2);
  });

  it("deletes a cell when edit_mode is delete", async () => {
    const nb = makeNotebook();
    nb.cells.push({
      id: "cell-2",
      cell_type: "markdown",
      source: ["# Title\n"],
    });
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(nbPath, JSON.stringify(nb), "utf8");

    const result = await notebookEditTool.execute({
      notebook_path: nbPath,
      cell_id: "cell-2",
      new_source: "",
      edit_mode: "delete",
    } as never);

    expect(result).toContain("Notebook updated");
    const updated = JSON.parse(await fs.readFile(nbPath, "utf8"));
    // The notebook JSON structure is not type-safe in this test context.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(updated.cells.find((cell: any) => cell.id === "cell-2")).toBeUndefined();
  });
});


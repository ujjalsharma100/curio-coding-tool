import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createTool } from "curio-agent-sdk";
import { z } from "zod";

type NotebookCell = {
  id?: string;
  cell_type: "code" | "markdown";
  source: string[] | string;
  outputs?: unknown[];
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
};

type NotebookJson = {
  cells: NotebookCell[];
  metadata?: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
};

function toSourceArray(source: string): string[] {
  return source.split("\n").map((line, index, all) => (index < all.length - 1 ? `${line}\n` : line));
}

function locateCell(notebook: NotebookJson, cellNumber?: number, cellId?: string): number {
  if (cellId) {
    const idx = notebook.cells.findIndex((cell) => cell.id === cellId);
    if (idx !== -1) return idx;
  }
  if (cellNumber !== undefined && cellNumber >= 0 && cellNumber < notebook.cells.length) {
    return cellNumber;
  }
  return -1;
}

export const notebookEditTool = createTool({
  name: "notebook_edit",
  description: "Edit Jupyter notebook cells by index or ID.",
  parameters: z.object({
    notebook_path: z.string().describe("Absolute path to .ipynb file"),
    cell_number: z.number().optional().describe("0-indexed cell number"),
    cell_id: z.string().optional().describe("Cell ID"),
    cell_type: z.enum(["code", "markdown"]).optional(),
    new_source: z.string().describe("New cell content"),
    edit_mode: z.enum(["replace", "insert", "delete"]).optional().default("replace"),
  }),
  execute: async ({ notebook_path, cell_number, cell_id, cell_type, new_source, edit_mode }) => {
    const absolutePath = path.resolve(notebook_path);
    try {
      const raw = await fs.readFile(absolutePath, "utf8");
      const notebook = JSON.parse(raw) as NotebookJson;

      if (!Array.isArray(notebook.cells)) {
        return `Invalid notebook format: ${absolutePath}`;
      }

      const targetIndex = locateCell(notebook, cell_number, cell_id);

      if (edit_mode === "replace") {
        if (targetIndex === -1) {
          return `Target cell not found in notebook: ${absolutePath}`;
        }
        const existing = notebook.cells[targetIndex];
        notebook.cells[targetIndex] = {
          ...existing,
          cell_type: cell_type ?? existing.cell_type,
          source: toSourceArray(new_source),
        };
      } else if (edit_mode === "insert") {
        const insertAt = targetIndex === -1 ? notebook.cells.length : targetIndex;
        notebook.cells.splice(insertAt, 0, {
          id: randomUUID(),
          cell_type: cell_type ?? "code",
          source: toSourceArray(new_source),
          outputs: cell_type === "markdown" ? undefined : [],
          metadata: {},
          execution_count: null,
        });
      } else if (edit_mode === "delete") {
        if (targetIndex === -1) {
          return `Target cell not found in notebook: ${absolutePath}`;
        }
        notebook.cells.splice(targetIndex, 1);
      }

      await fs.writeFile(absolutePath, JSON.stringify(notebook, null, 2), "utf8");
      return `Notebook updated: ${absolutePath} (mode: ${edit_mode})`;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return `File not found: ${absolutePath}`;
      }
      return `Failed to edit notebook: ${absolutePath}\n${nodeError.message}`;
    }
  },
});

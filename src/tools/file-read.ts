import fs from "node:fs/promises";
import path from "node:path";
import * as pdfParseModule from "pdf-parse";
import { createTool } from "curio-agent-sdk";
import { z } from "zod";
import { toolSessionState } from "./session-state.js";

const DEFAULT_LINE_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_PDF_PAGES = 20;
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
]);

function formatLineNumbered(text: string, offset: number, limit: number): string {
  const lines = text.split(/\r?\n/);
  const start = Math.max(1, offset);
  const end = Math.min(lines.length, start - 1 + limit);
  const selected = lines.slice(start - 1, end);
  const width = String(end).length;
  const rendered = selected.map((line, index) => {
    const lineNumber = String(start + index).padStart(width, " ");
    const normalized =
      line.length > MAX_LINE_LENGTH
        ? `${line.slice(0, MAX_LINE_LENGTH)}[truncated]`
        : line;
    return `${lineNumber}\t${normalized}`;
  });

  if (end < lines.length) {
    rendered.push(`[truncated - ${lines.length - end} more lines]`);
  }

  return rendered.join("\n");
}

function parsePageSelection(selection: string): number[] {
  const trimmed = selection.trim();
  if (/^\d+$/.test(trimmed)) {
    return [Number(trimmed)];
  }
  const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (end < start) {
      throw new Error(`Invalid page range: ${selection}`);
    }
    const pages: number[] = [];
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    return pages;
  }
  throw new Error(`Invalid pages format: ${selection}`);
}

function renderNotebook(content: string): string {
  const parsed = JSON.parse(content) as {
    cells?: Array<{
      cell_type?: string;
      source?: string[] | string;
      outputs?: Array<{ output_type?: string; text?: string[] | string }>;
    }>;
  };

  if (!Array.isArray(parsed.cells)) {
    return "Notebook has no cells.";
  }

  const chunks = parsed.cells.map((cell, index) => {
    const source = Array.isArray(cell.source) ? cell.source.join("") : (cell.source ?? "");
    const outputs =
      cell.outputs
        ?.map((output) => {
          if (Array.isArray(output.text)) {
            return output.text.join("");
          }
          return output.text ?? output.output_type ?? "";
        })
        .filter(Boolean)
        .join("\n") ?? "";
    const header = `[Cell ${index} - ${cell.cell_type ?? "unknown"}]`;
    if (!outputs) {
      return `${header}\n${source}`;
    }
    return `${header}\n${source}\n[Output]\n${outputs}`;
  });

  return chunks.join("\n\n");
}

export const fileReadTool = createTool({
  name: "read_file",
  description:
    "Read file content with line numbers, pagination, notebook/PDF parsing, and basic binary/image handling.",
  parameters: z.object({
    file_path: z.string().describe("Absolute path to the file"),
    offset: z.number().optional().describe("Line number to start from (1-indexed)"),
    limit: z.number().optional().describe("Number of lines to read"),
    pages: z
      .string()
      .optional()
      .describe("Optional PDF pages selector like '1-5', '3', or '10-20'"),
    supports_vision: z
      .boolean()
      .optional()
      .describe("When true, image files are returned as base64 payload"),
  }),
  execute: async ({ file_path, offset, limit, pages, supports_vision }) => {
    const absolutePath = path.resolve(file_path);
    try {
      const extension = path.extname(absolutePath).toLowerCase();

      if (IMAGE_EXTENSIONS.has(extension)) {
        if (!supports_vision) {
          return "Image file - cannot display (model does not support vision)";
        }
        const imageBuffer = await fs.readFile(absolutePath);
        toolSessionState.markFileRead(absolutePath);
        return JSON.stringify(
          {
            type: "image_base64",
            file_path: absolutePath,
            media_type: extension === ".jpg" ? "image/jpeg" : `image/${extension.slice(1)}`,
            data: imageBuffer.toString("base64"),
          },
          null,
          2,
        );
      }

      if (extension === ".pdf") {
        const pdfBuffer = await fs.readFile(absolutePath);
        const pdfParseFn =
          (pdfParseModule as unknown as { default?: (buf: Buffer) => Promise<{ text: string }> })
            .default ?? (pdfParseModule as unknown as (buf: Buffer) => Promise<{ text: string }>);
        const parsed = await pdfParseFn(pdfBuffer);
        const pageTexts = parsed.text.split("\f");
        let selectedPages = pageTexts;
        if (pages) {
          const pageIndexes = parsePageSelection(pages);
          if (pageIndexes.length > MAX_PDF_PAGES) {
            return `PDF page limit exceeded. Maximum ${MAX_PDF_PAGES} pages per request.`;
          }
          selectedPages = pageIndexes
            .filter((pageNumber) => pageNumber > 0 && pageNumber <= pageTexts.length)
            .map((pageNumber) => pageTexts[pageNumber - 1] ?? "");
        }
        toolSessionState.markFileRead(absolutePath);
        return selectedPages.join("\n\n");
      }

      const buffer = await fs.readFile(absolutePath);
      const binaryProbe = buffer.subarray(0, 512);
      if (binaryProbe.includes(0)) {
        return "Binary file, cannot display";
      }

      const text = buffer.toString("utf8");
      if (extension === ".ipynb") {
        toolSessionState.markFileRead(absolutePath);
        return renderNotebook(text);
      }

      const formatted = formatLineNumbered(text, offset ?? 1, limit ?? DEFAULT_LINE_LIMIT);
      toolSessionState.markFileRead(absolutePath);
      return formatted;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return `File not found: ${absolutePath}`;
      }
      if (nodeError.code === "EACCES" || nodeError.code === "EPERM") {
        return `Permission denied: ${absolutePath}`;
      }
      return `Failed to read file: ${absolutePath}\n${nodeError.message}`;
    }
  },
});

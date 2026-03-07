import { readFileSync, readdirSync, statSync, globSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export interface FileReference {
  /** Original @path string from user input */
  raw: string;
  /** Resolved absolute file path */
  absPath: string;
  /** Path relative to cwd */
  relPath: string;
  /** Optional line range [start, end] (1-indexed, inclusive) */
  lineRange?: [number, number];
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Whether this is a glob pattern */
  isGlob: boolean;
}

export interface ResolvedFileContent {
  ref: FileReference;
  content: string;
  tokenEstimate: number;
}

/**
 * Parse @references from user input text.
 * Supports: @path/to/file, @path/to/file:10-20, @src/dir/, @src/**\/*.test.ts
 */
export function parseFileReferences(input: string, cwd: string): FileReference[] {
  const refs: FileReference[] = [];
  // Match @ followed by a non-space path, optionally with :lineStart-lineEnd
  const regex = /@([\w./_\-*{}[\]]+(?::(\d+)-(\d+))?)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    const rawPath = match[1]!;
    const lineStartStr = match[2];
    const lineEndStr = match[3];

    // Strip trailing line range from path
    const pathOnly = rawPath.replace(/:\d+-\d+$/, "");

    // Check for glob patterns
    const isGlob = pathOnly.includes("*") || pathOnly.includes("{") || pathOnly.includes("?");

    if (isGlob) {
      // Expand glob pattern
      try {
        const matches = globSync(pathOnly, { cwd });
        for (const m of matches) {
          const absPath = resolve(cwd, m);
          try {
            if (statSync(absPath).isFile()) {
              refs.push({
                raw: match[0]!,
                absPath,
                relPath: relative(cwd, absPath),
                isDirectory: false,
                isGlob: true,
              });
            }
          } catch { /* skip inaccessible files */ }
        }
      } catch { /* glob failed, skip */ }
      continue;
    }

    const absPath = resolve(cwd, pathOnly);

    let isDir = false;
    try {
      isDir = statSync(absPath).isDirectory();
    } catch {
      // File might not exist yet, still include the reference
    }

    const lineRange: [number, number] | undefined =
      lineStartStr && lineEndStr
        ? [parseInt(lineStartStr, 10), parseInt(lineEndStr, 10)]
        : undefined;

    refs.push({
      raw: match[0]!,
      absPath,
      relPath: relative(cwd, absPath),
      lineRange,
      isDirectory: isDir,
      isGlob: false,
    });
  }

  return refs;
}

/**
 * Read the content for a file reference.
 */
export function resolveFileContent(ref: FileReference): ResolvedFileContent {
  if (ref.isDirectory) {
    try {
      const entries = readdirSync(ref.absPath);
      const listing = entries
        .map((e) => {
          try {
            const s = statSync(join(ref.absPath, e));
            return s.isDirectory() ? `${e}/` : e;
          } catch {
            return e;
          }
        })
        .join("\n");
      return {
        ref,
        content: `Directory listing: ${ref.relPath}/\n${listing}`,
        tokenEstimate: Math.ceil(listing.length / 4),
      };
    } catch (err) {
      return {
        ref,
        content: `Error reading directory ${ref.relPath}: ${err instanceof Error ? err.message : String(err)}`,
        tokenEstimate: 10,
      };
    }
  }

  try {
    const raw = readFileSync(ref.absPath, "utf-8");
    let content: string;

    if (ref.lineRange) {
      const lines = raw.split("\n");
      const [start, end] = ref.lineRange;
      content = lines.slice(start - 1, end).join("\n");
    } else {
      content = raw;
    }

    const rangeLabel = ref.lineRange
      ? `:${ref.lineRange[0]}-${ref.lineRange[1]}`
      : "";

    return {
      ref,
      content: `File: ${ref.relPath}${rangeLabel}\n${"─".repeat(40)}\n${content}`,
      tokenEstimate: Math.ceil(content.length / 4),
    };
  } catch (err) {
    return {
      ref,
      content: `Error reading ${ref.relPath}: ${err instanceof Error ? err.message : String(err)}`,
      tokenEstimate: 10,
    };
  }
}

/**
 * Get file/directory completions for the @ autocomplete popup.
 */
export function getFileCompletions(
  partial: string,
  cwd: string,
  maxResults = 20,
): string[] {
  // partial is the text after @ (e.g., "src/cl")
  const dir = partial.includes("/")
    ? resolve(cwd, partial.substring(0, partial.lastIndexOf("/") + 1))
    : cwd;

  const prefix = partial.includes("/")
    ? partial.substring(partial.lastIndexOf("/") + 1)
    : partial;

  try {
    const entries = readdirSync(dir);
    const matches = entries
      .filter((e) => !e.startsWith(".") && e.toLowerCase().startsWith(prefix.toLowerCase()))
      .slice(0, maxResults)
      .map((e) => {
        const fullPath = join(dir, e);
        try {
          const isDir = statSync(fullPath).isDirectory();
          const relFromCwd = relative(cwd, fullPath);
          return isDir ? `${relFromCwd}/` : relFromCwd;
        } catch {
          return relative(cwd, fullPath);
        }
      });
    return matches;
  } catch {
    return [];
  }
}

/**
 * Strip @references from the input text (for clean display).
 */
export function stripFileReferences(input: string): string {
  return input.replace(/@[\w./_\-*{}[\]]+(?::\d+-\d+)?/g, "").replace(/\s+/g, " ").trim();
}

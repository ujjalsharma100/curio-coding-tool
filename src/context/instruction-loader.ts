import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ignore from "ignore";
import { InstructionLoader } from "curio-agent-sdk";

export interface LoadedInstructions {
  merged: string;
  files: string[];
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readCurioIgnore(projectRoot: string): Promise<ReturnType<typeof ignore> | null> {
  const curioIgnorePath = path.join(projectRoot, ".curioignore");
  try {
    const content = await fs.readFile(curioIgnorePath, "utf8");
    return ignore().add(content);
  } catch {
    return null;
  }
}

async function findProjectRoot(startDir: string): Promise<string> {
  let current = path.resolve(startDir);
  while (true) {
    if (
      (await exists(path.join(current, ".git"))) ||
      (await exists(path.join(current, "package.json"))) ||
      (await exists(path.join(current, "pyproject.toml")))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(startDir);
    current = parent;
  }
}

function buildSearchPaths(cwd: string, projectRoot: string): string[] {
  const paths: string[] = [];
  const globalPath = path.join(os.homedir(), ".curio-code");
  paths.push(globalPath);

  const chain: string[] = [];
  let current = path.resolve(cwd);
  while (true) {
    chain.push(current);
    if (current === projectRoot) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  chain.reverse().forEach((dir) => paths.push(dir));
  return Array.from(new Set(paths));
}

export async function loadCurioInstructions(
  cwd: string = process.cwd(),
): Promise<LoadedInstructions> {
  const projectRoot = await findProjectRoot(cwd);
  const curioIgnore = await readCurioIgnore(projectRoot);
  const searchPaths = buildSearchPaths(cwd, projectRoot);
  const fileNames = ["CURIO.md", ".curio-code/rules.md"];

  const loader = new InstructionLoader({
    fileNames,
    searchPaths,
    mergeSeparator: "\n\n---\n\n",
  });

  const merged = loader.load();
  if (!merged) {
    return { merged: "", files: [] };
  }

  const loadedFiles: string[] = [];
  for (const base of searchPaths) {
    for (const fileName of fileNames) {
      const fullPath = path.resolve(base, fileName);
      if (!(await exists(fullPath))) continue;
      const relativeToRoot = path.relative(projectRoot, fullPath);
      if (curioIgnore && curioIgnore.ignores(relativeToRoot)) {
        continue;
      }
      loadedFiles.push(fullPath);
    }
  }

  return {
    merged,
    files: Array.from(new Set(loadedFiles)),
  };
}

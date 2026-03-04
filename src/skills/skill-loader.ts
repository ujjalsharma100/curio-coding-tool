import { Skill, SkillRegistry } from "curio-agent-sdk";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

export interface SkillManifest {
  name: string;
  description: string;
  command?: string;
  instructions?: string;
}

function loadSkillFromDir(dir: string): Skill | null {
  const manifestPath = join(dir, "skill.yaml");
  const instructionsPath = join(dir, "SKILL.md");

  let name = dir.split("/").pop() ?? "unknown";
  let description = "";
  let instructions = "";

  if (existsSync(instructionsPath)) {
    instructions = readFileSync(instructionsPath, "utf-8");
  }

  if (existsSync(manifestPath)) {
    const raw = readFileSync(manifestPath, "utf-8");
    const parsed = parseSimpleYaml(raw);
    name = parsed.name ?? name;
    description = parsed.description ?? "";
  }

  if (!instructions && !description) return null;

  return new Skill({
    name,
    description,
    instructions,
    tools: [],
    hooks: [],
  });
}

function parseSimpleYaml(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^(\w+)\s*:\s*(.+)/);
    if (match) {
      result[match[1]!] = match[2]!.trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

function loadSkillsFromDirectory(baseDir: string): Skill[] {
  if (!existsSync(baseDir)) return [];

  const skills: Skill[] = [];
  try {
    const entries = readdirSync(baseDir);
    for (const entry of entries) {
      const entryPath = join(baseDir, entry);
      if (statSync(entryPath).isDirectory()) {
        const skill = loadSkillFromDir(entryPath);
        if (skill) skills.push(skill);
      }
    }
  } catch {
    // Directory access error — skip
  }
  return skills;
}

export function createSkillRegistry(projectRoot?: string): SkillRegistry {
  const registry = new SkillRegistry();

  const builtInDir = resolve(
    new URL(".", import.meta.url).pathname,
  );
  for (const skill of loadSkillsFromDirectory(builtInDir)) {
    registry.register(skill);
    registry.activate(skill.name);
  }

  const userDir = join(homedir(), ".curio-code", "skills");
  for (const skill of loadSkillsFromDirectory(userDir)) {
    registry.register(skill);
    registry.activate(skill.name);
  }

  if (projectRoot) {
    const projectDir = join(projectRoot, ".curio-code", "skills");
    for (const skill of loadSkillsFromDirectory(projectDir)) {
      registry.register(skill);
      registry.activate(skill.name);
    }
  }

  return registry;
}

export function getSkillInstructions(registry: SkillRegistry, name: string): string | null {
  const skill = registry.get(name);
  if (!skill) return null;
  return skill.instructions ?? skill.description ?? null;
}

export function listSkillNames(registry: SkillRegistry): string[] {
  return registry.list().map((s) => s.name);
}

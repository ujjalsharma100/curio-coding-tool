/**
 * Auto-detects patterns in conversation worth remembering.
 *
 * Matches:
 * - User preferences: "always use bun", "prefer functional style", "use tabs"
 * - Project conventions confirmed across interactions
 * - Architectural decisions mentioned by user
 * - Solutions to recurring problems
 */

const PREFERENCE_PATTERNS = [
  /\b(?:always|prefer|use|never)\s+(?:use|using)?\s*(\w[\w\s]{2,40})/i,
  /\b(?:don't|do not|never)\s+(?:use|add|include)\s+(\w[\w\s]{2,40})/i,
  /\bprefer\s+(\w[\w\s]{2,40})\s+(?:over|instead|rather)/i,
  /\b(?:convention|standard|rule):\s*(.{5,80})/i,
  /\b(?:our|the|this)\s+(?:project|codebase|repo)\s+(?:uses|follows|prefers)\s+(.{5,80})/i,
];

const ARCHITECTURE_PATTERNS = [
  /\b(?:architecture|pattern|approach):\s*(.{5,100})/i,
  /\bwe\s+(?:use|follow|implement)\s+(.{5,80})\s+(?:pattern|architecture|approach)/i,
  /\b(?:database|db|storage|backend|frontend|api)\s+(?:is|uses)\s+(.{5,60})/i,
];

const REMEMBER_COMMAND = /\bremember\s+(?:that\s+|this:\s*)?(.{5,200})/i;

export interface DetectedMemory {
  content: string;
  category: "preference" | "convention" | "architecture" | "explicit";
}

export function detectMemoriesInMessage(userMessage: string): DetectedMemory[] {
  const detected: DetectedMemory[] = [];

  const rememberMatch = REMEMBER_COMMAND.exec(userMessage);
  if (rememberMatch) {
    detected.push({
      content: rememberMatch[1]!.trim(),
      category: "explicit",
    });
    return detected;
  }

  for (const pattern of PREFERENCE_PATTERNS) {
    const match = pattern.exec(userMessage);
    if (match?.[1]) {
      detected.push({
        content: `User preference: ${match[1].trim()}`,
        category: "preference",
      });
    }
  }

  for (const pattern of ARCHITECTURE_PATTERNS) {
    const match = pattern.exec(userMessage);
    if (match?.[1]) {
      detected.push({
        content: `Architecture: ${match[1].trim()}`,
        category: "architecture",
      });
    }
  }

  return detected;
}

export function shouldForget(userMessage: string): string | null {
  const forgetMatch = /\bforget\s+(?:about\s+)?(.{3,100})/i.exec(userMessage);
  return forgetMatch?.[1]?.trim() ?? null;
}

import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { Theme } from "../theme.js";

export interface CommandMenuItem {
  readonly command: string;
  readonly brief: string;
  readonly category: string;
}

export interface CommandMenuProps {
  readonly theme: Theme;
  readonly filter: string;
  readonly items: CommandMenuItem[];
  readonly selectedIndex: number;
  readonly termWidth: number;
  readonly maxVisible?: number;
}

const CATEGORY_ORDER = [
  "Session",
  "Model",
  "Info",
  "Memory",
  "Tools",
  "Other",
];

export function getFilteredItems(
  items: CommandMenuItem[],
  filter: string,
): CommandMenuItem[] {
  if (!filter || filter === "/") return items;
  const lower = filter.toLowerCase();
  return items.filter((item) => item.command.startsWith(lower));
}

export function CommandMenu({
  theme,
  filter,
  items,
  selectedIndex,
  termWidth,
  maxVisible = 10,
}: CommandMenuProps): JSX.Element {
  const filtered = useMemo(() => getFilteredItems(items, filter), [items, filter]);

  if (filtered.length === 0) {
    return (
      <Box borderStyle="round" borderColor={theme.dim} paddingX={1} width={termWidth}>
        <Text color={theme.muted} italic>No matching commands</Text>
      </Box>
    );
  }

  // Group by category for display
  const grouped = new Map<string, CommandMenuItem[]>();
  for (const item of filtered) {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category)!.push(item);
  }

  // Build flat display list with category headers
  const rows: Array<
    | { kind: "header"; label: string }
    | { kind: "item"; item: CommandMenuItem; flatIdx: number }
  > = [];
  let flatIdx = 0;
  for (const cat of CATEGORY_ORDER) {
    const catItems = grouped.get(cat);
    if (!catItems?.length) continue;
    rows.push({ kind: "header", label: cat });
    for (const item of catItems) {
      rows.push({ kind: "item", item, flatIdx: flatIdx++ });
    }
  }
  for (const [cat, catItems] of grouped) {
    if (CATEGORY_ORDER.includes(cat)) continue;
    rows.push({ kind: "header", label: cat });
    for (const item of catItems) {
      rows.push({ kind: "item", item, flatIdx: flatIdx++ });
    }
  }

  const clampedIdx = Math.min(selectedIndex, filtered.length - 1);

  // Windowing
  const total = filtered.length;
  let winStart = 0;
  let winEnd = total;
  if (total > maxVisible) {
    winStart = Math.max(0, clampedIdx - Math.floor(maxVisible / 2));
    winEnd = Math.min(total, winStart + maxVisible);
    if (winEnd - winStart < maxVisible) winStart = Math.max(0, winEnd - maxVisible);
  }

  return (
    <Box borderStyle="round" borderColor={theme.inputBorder} paddingX={1} flexDirection="column" width={termWidth}>
      {rows.map((row, i) => {
        if (row.kind === "header") {
          // Only render header if at least one item in this category is visible
          return <Text key={`h-${row.label}-${i}`} color={theme.dim} bold>{row.label}</Text>;
        }
        const { item, flatIdx: fi } = row;
        if (fi < winStart || fi >= winEnd) return null;
        const sel = fi === clampedIdx;
        const matchLen = filter.length;
        return (
          <Box key={item.command}>
            <Text color={sel ? theme.accent : theme.dim}>{sel ? "> " : "  "}</Text>
            <Text color={theme.accent} bold={sel}>{item.command.slice(0, matchLen)}</Text>
            <Text color={sel ? theme.accent : theme.accentSoft}>{item.command.slice(matchLen)}</Text>
            <Text color={theme.muted}>  {item.brief}</Text>
          </Box>
        );
      })}
      {total > maxVisible && (
        <Text color={theme.dim} italic>  {clampedIdx + 1}/{total}</Text>
      )}
    </Box>
  );
}

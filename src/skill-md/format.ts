/**
 * Conservative `SKILL.md` formatter: normalises the frontmatter block and
 * whitespace, never rewrites body prose. Pure text-in/text-out — no fs.
 */

import { isMap, parseDocument, type YAMLMap } from "yaml";
import { mapBodyLines, splitFrontmatter } from "./document.js";

/** Frontmatter keys the formatter floats to the top, in this order. */
const HEAD_KEYS = ["name", "description"];

/**
 * Format a `SKILL.md`. Re-serialises the frontmatter (`name`, `description`
 * first, remaining keys in original order, no line wrapping), puts exactly
 * one blank line between the closing `---` and the body, strips trailing
 * whitespace outside fenced code blocks, and ends the file with one newline.
 * Frontmatter comments and scalar quoting styles are preserved. When there is
 * no parseable frontmatter mapping, returns `source` unchanged — the linter
 * reports that; the formatter must never destroy content.
 */
export function formatSkillMd(source: string): string {
  const block = splitFrontmatter(source);
  if (!block) return source;

  const doc = parseDocument(block.yaml);
  if (doc.errors.length > 0 || !isMap(doc.contents)) return source;

  reorderKeys(doc.contents);
  const head = `---\n${doc.toString({ lineWidth: 0 })}---\n`;
  const lines = mapBodyLines(block.body, (line, kind) =>
    kind === "inside" ? line : line.trimEnd(),
  );
  while (lines[0] === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.length === 0 ? head : `${head}\n${lines.join("\n")}\n`;
}

/**
 * Reorder the mapping in place so `name` and `description` come first (when
 * present) and every other entry — with its comments and quoting — keeps its
 * original order (`sort` is stable).
 */
function reorderKeys(map: YAMLMap): void {
  const rank = (pair: { key?: unknown }) => {
    const key = pair.key as { value?: unknown } | string | undefined;
    const name =
      typeof key === "object" && key !== null && "value" in key
        ? String(key.value)
        : String(key);
    const index = HEAD_KEYS.indexOf(name);
    return index === -1 ? HEAD_KEYS.length : index;
  };
  map.items.sort((a, b) => rank(a) - rank(b));
}

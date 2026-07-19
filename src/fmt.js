/**
 * @file Conservative `SKILL.md` formatter: normalises the frontmatter block and
 * whitespace, never rewrites body prose. Pure text-in/text-out — no fs.
 */

import { isMap, parseDocument } from "yaml";
import { splitFrontmatter, mapBodyLines } from "./skillmd.js";

/** Frontmatter keys the formatter floats to the top, in this order. */
const HEAD_KEYS = ["name", "description"];

/**
 * Format a `SKILL.md`. Re-serialises the frontmatter (`name`, `description`
 * first, remaining keys in original order, no line wrapping), puts exactly one
 * blank line between the closing `---` and the body, strips trailing
 * whitespace outside fenced code blocks, and ends the file with one newline.
 * Frontmatter comments and scalar quoting styles are preserved. When there is
 * no parseable frontmatter mapping, returns `source` unchanged — the linter
 * reports that; the formatter must never destroy content.
 *
 * @param {string} source  Full `SKILL.md` text.
 * @returns {string}
 */
export function formatSkillMd(source) {
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
 *
 * @param {import("yaml").YAMLMap} map
 * @returns {void}
 */
function reorderKeys(map) {
  const rank = (/** @type {any} */ pair) => {
    const index = HEAD_KEYS.indexOf(String(pair.key?.value ?? pair.key));
    return index === -1 ? HEAD_KEYS.length : index;
  };
  map.items.sort((a, b) => rank(a) - rank(b));
}

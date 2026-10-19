/** The rules sitting directly at the top of a stylesheet: a rule whose body holds no nested block, with
 * its selector list whitespace-stripped. An at-rule's own block is skipped, and so is everything inside
 * it. Not structure: comments, quoted strings, an unquoted `url(...)`, and any character after a
 * backslash. A statement at-rule (`@layer a,b;`, `@import ...;`) ends at its `;`, so it never joins
 * the next rule's selector.
 * @param {string} css */
export function topLevelRules(css) {
  return topLevelBlocks(css)
    .filter(({ prelude, nested }) => !prelude.startsWith("@") && !nested)
    .map(({ prelude, body }) => ({
      selectors: prelude.split(",").map((part) => part.replace(/\s+/g, "")),
      body,
    }));
}

/** The stylesheet outside every top-level at-rule block whose prelude matches `preludePattern`, and
 * those blocks as source text. Walks the same structure as `topLevelRules`, so a brace inside a string
 * or a comment never ends a block early.
 * @param {string} css
 * @param {RegExp} preludePattern */
export function splitAtRuleBlocks(css, preludePattern) {
  /** @type {string[]} */
  const blocks = [];
  let outside = "";
  let cursor = 0;
  for (const block of topLevelBlocks(css)) {
    if (!preludePattern.test(block.prelude)) continue;
    outside += css.slice(cursor, block.start);
    blocks.push(css.slice(block.start, block.end));
    cursor = block.end;
  }
  return { outside: outside + css.slice(cursor), blocks };
}

/** @param {string} css */
function topLevelBlocks(css) {
  /** @type {{ prelude: string, body: string, nested: boolean, start: number, end: number }[]} */
  const found = [];
  let start = 0;
  let depth = 0;
  let prelude = "";
  let body = "";
  /** @type {string | null} */
  let quote = null;
  let nested = false;
  let index = 0;
  const append = (/** @type {string} */ text) => {
    if (depth === 0) {
      if (prelude.trim() === "" && text.trim() !== "") start = index;
      prelude += text;
    } else body += text;
  };
  for (index = 0; index < css.length; index++) {
    const char = css[index];
    if (quote === null && char === "/" && css[index + 1] === "*") {
      const end = css.indexOf("*/", index + 2);
      index = end === -1 ? css.length : end + 1;
      continue;
    }
    if (char === "\\") {
      append(char + (css[index + 1] ?? ""));
      index++;
      continue;
    }
    if (quote !== null) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(" && /url$/i.test(depth === 0 ? prelude : body)) {
      const close = css.indexOf(")", index);
      const inside = css.slice(index + 1, close === -1 ? css.length : close);
      if (!/^\s*["']/.test(inside)) {
        append(css.slice(index, close === -1 ? css.length : close + 1));
        index = close === -1 ? css.length : close;
        continue;
      }
    } else if (char === "{") {
      depth++;
      if (depth === 1) continue;
      nested = true;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        found.push({
          prelude: prelude.trim(),
          body,
          nested,
          start,
          end: index + 1,
        });
        prelude = "";
        body = "";
        nested = false;
        continue;
      }
    } else if (char === ";" && depth === 0) {
      prelude = "";
      continue;
    }
    append(char);
  }
  return found;
}

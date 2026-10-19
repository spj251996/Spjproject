import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The stylesheets a built route's HTML links, each read from the export under `root`. A sheet the
 * export does not contain comes back with `css: null` rather than an empty string, so a gate can fail
 * on it instead of reading it as a sheet with nothing in it.
 * @param {string} html
 * @param {string} root */
export function linkedStylesheets(html, root) {
  const hrefs = [
    ...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g),
    ...html.matchAll(/<link[^>]*href="([^"]+)"[^>]*rel="stylesheet"/g),
  ].map((m) => m[1]);
  return [...new Set(hrefs)].map((href) => {
    const file = join(root, href.replace(/^\//, ""));
    return { href, css: existsSync(file) ? readFileSync(file, "utf8") : null };
  });
}

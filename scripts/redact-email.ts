/**
 * Turn a raw TrainingPeaks email (saved in gitignored fixtures/raw/) into a
 * fixture that is safe to commit: links, image sources, tracking URLs and
 * email addresses become "#", styles and comments other than the section
 * markers are dropped, and whitespace is collapsed (blank lines kept). Workout content is kept
 * exactly, so the parser sees the same structure.
 *
 *   npm run redact -- fixtures/raw/tp-2026-10-24.html fixtures/trainingpeaks-2026-10-24.html
 */
import { readFileSync, writeFileSync } from "node:fs";

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error("usage: redact <raw.html> <fixture.html>");
  process.exit(2);
}

const html = readFileSync(src, "utf8")
  .replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<!--(?!\s*(?:NOTES|Structured Strength|WORKOUTS|TITLE)[^>]*-->)[\s\S]*?-->/g, "")
  .replace(/\s(href|src|background|xmlns(?::\w+)?)\s*=\s*("[^"]*"|'[^']*')/gi, ' $1="#"')
  .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, "")
  .replace(/https?:\/\/[^\s"'<>]+/gi, "#")
  .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "#")
  // Collapse whitespace, but keep blank lines: they separate the coach's paragraphs.
  .replace(/\s+/g, (ws) => (/\n[^\S\n]*\n/.test(ws) ? "\n\n" : " "));

writeFileSync(dest, html);
console.log(`${src} → ${dest} (${html.length} bytes)`);

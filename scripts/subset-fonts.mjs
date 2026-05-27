// scripts/subset-fonts.mjs
// Subsets the dashboard fonts to a minimal Latin + symbols glyph set.
// Overwrites public/fonts/*.ttf in place. Safe to re-run.
//
// Run with: node scripts/subset-fonts.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import subsetFont from "subset-font";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, "..", "public", "fonts");

// Characters the dashboard SVG could contain.
// - Basic ASCII printable (32-126)
// - Common Latin-1 supplement + Latin Extended-A (broad Western European + Slavic)
// - Symbols used in the renderer
const charset =
  // Basic ASCII printables
  Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("") +
  // Latin-1 supplement letters (a sampling of the most common accented forms)
  "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß" +
  "àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ" +
  // Latin Extended-A: Slavic, Eastern European
  "ĀāĂăĄąĆćČčĎďĐđĒēĖėĘęĚěĞğĢģĪīĮįİıĶķĹĺĻļĽľŁłŃńŅņŇňŌōŐőŒœŔŕŖŗŘřŚśŞşŠšŢţŤťŪūŮůŰűŲųŸŹźŻżŽž" +
  // Symbols used by the dashboard
  "·•×✓✗←→↑↓—–‒‐−°±≤≥%€$£¥@#&*";

console.log(`Subsetting to ${charset.length} unique characters`);

const fonts = ["Inter-Regular.ttf", "Inter-Bold.ttf", "JetBrainsMono-Bold.ttf"];

for (const name of fonts) {
  const path = join(FONTS_DIR, name);
  const input = await readFile(path);
  const output = await subsetFont(input, charset, { targetFormat: "truetype" });
  await writeFile(path, output);
  const beforeKB = (input.length / 1024).toFixed(1);
  const afterKB = (output.length / 1024).toFixed(1);
  const pct = ((1 - output.length / input.length) * 100).toFixed(0);
  console.log(`${name.padEnd(28)} ${beforeKB} KB → ${afterKB} KB  (-${pct}%)`);
}
console.log("Done.");

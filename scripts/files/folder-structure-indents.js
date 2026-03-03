// scripts/files/folder-structure-indents.js
import fs from "fs";
import path from "path";

const EXCLUDE_DIRS = new Set(["node_modules", ".git"]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function collectDirs(absDir, baseAbs) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (EXCLUDE_DIRS.has(ent.name)) continue;

    const childAbs = path.join(absDir, ent.name);
    const rel = path.relative(baseAbs, childAbs);

    results.push(rel);
    results.push(...collectDirs(childAbs, baseAbs));
  }

  return results;
}

function toIndented(relPaths) {
  relPaths.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return relPaths.map((rel) => {
    const parts = rel.split(path.sep).filter(Boolean);
    const depth = parts.length - 1;
    const leaf = parts[parts.length - 1];
    return "\t".repeat(depth) + leaf;
  });
}

function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error("Provide a folder path.");
    console.error('Example: npm run folders -- "E:\\cara\\node-utils"');
    process.exit(1);
  }

  const inputAbs = path.resolve(inputArg);

  if (!fs.existsSync(inputAbs) || !fs.statSync(inputAbs).isDirectory()) {
    console.error("Invalid directory:", inputAbs);
    process.exit(1);
  }

  const outputArg = process.argv[3];
  const outputPath = outputArg
    ? path.resolve(outputArg)
    : path.join(inputAbs, "folder-structure-tabs.txt"); // <- “same folder as source”

  ensureDir(path.dirname(outputPath));

  const relDirs = collectDirs(inputAbs, inputAbs);
  const lines = toIndented(relDirs);

  fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf8");

  console.log("✅ Input:", inputAbs);
  console.log("✅ Output:", outputPath);
  console.log("✅ Folders:", lines.length);
}

main();
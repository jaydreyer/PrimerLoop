import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = process.cwd();
const SEED_PATH = path.join(REPO_ROOT, "supabase", "seed.sql");
const CONTENT_ROOT = path.join(REPO_ROOT, "content");

function extractSeedConceptSlugs(seedSql) {
  const insertStart = seedSql.indexOf("insert into concepts");
  const insertEnd = seedSql.indexOf("on conflict (slug) do nothing;", insertStart);
  if (insertStart < 0 || insertEnd < 0) {
    throw new Error("Unable to locate concepts seed insert block in supabase/seed.sql");
  }

  const block = seedSql.slice(insertStart, insertEnd);
  const tupleRegex =
    /\(\s*'([^']+)'\s*,\s*'(?:''|[^'])*'\s*,\s*'(?:''|[^'])*'\s*,\s*'(?:''|[^'])*'\s*,\s*'(?:''|[^'])*'\s*\)/g;

  const slugs = [];
  let match;
  while ((match = tupleRegex.exec(block)) !== null) {
    slugs.push(match[1]);
  }

  return slugs;
}

async function listJsonFilesRecursively(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFilesRecursively(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function extractContentConceptSlugs(contentRoot) {
  const files = await listJsonFilesRecursively(contentRoot);
  const slugs = [];
  const invalidFiles = [];

  for (const filePath of files) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      invalidFiles.push(`${filePath} (invalid JSON: ${error instanceof Error ? error.message : "unknown error"})`);
      continue;
    }

    if (!parsed || typeof parsed !== "object" || typeof parsed.concept_slug !== "string") {
      invalidFiles.push(`${filePath} (missing string concept_slug)`);
      continue;
    }

    slugs.push({
      slug: parsed.concept_slug.trim(),
      filePath,
    });
  }

  return { slugs, invalidFiles };
}

function findDuplicates(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function logList(title, values) {
  console.log(`\n${title} (${values.length})`);
  if (values.length === 0) {
    console.log("- none");
    return;
  }
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

async function main() {
  const seedSql = await readFile(SEED_PATH, "utf8");
  const seedSlugs = extractSeedConceptSlugs(seedSql);
  const { slugs: contentSlugsWithPath, invalidFiles } = await extractContentConceptSlugs(CONTENT_ROOT);
  const contentSlugs = contentSlugsWithPath.map((entry) => entry.slug);

  const seedUnique = [...new Set(seedSlugs)];
  const contentUnique = [...new Set(contentSlugs)];

  const seedSet = new Set(seedUnique);
  const contentSet = new Set(contentUnique);

  const onlyInSeed = seedUnique.filter((slug) => !contentSet.has(slug));
  const onlyInContent = contentUnique.filter((slug) => !seedSet.has(slug));
  const duplicateSeed = findDuplicates(seedSlugs);
  const duplicateContent = findDuplicates(contentSlugs);

  console.log("Slug audit summary:");
  console.log(`- seed concept slugs: ${seedSlugs.length} (${seedUnique.length} unique)`);
  console.log(`- content concept slugs: ${contentSlugs.length} (${contentUnique.length} unique)`);
  console.log(`- invalid content files: ${invalidFiles.length}`);

  logList("Only in seed.sql", onlyInSeed);
  logList("Only in content", onlyInContent);
  logList("Duplicate slugs in seed.sql", duplicateSeed);
  logList("Duplicate slugs in content", duplicateContent);
  logList("Invalid content files", invalidFiles);

  const hasMismatch =
    onlyInSeed.length > 0 ||
    onlyInContent.length > 0 ||
    duplicateSeed.length > 0 ||
    duplicateContent.length > 0 ||
    invalidFiles.length > 0;

  if (hasMismatch) {
    process.exitCode = 1;
    return;
  }

  console.log("\nSlug audit passed.");
}

await main();

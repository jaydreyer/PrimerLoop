/** @vitest-environment node */

import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";

async function collectRouteFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectRouteFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") {
      out.push(fullPath);
    }
  }

  return out;
}

describe("API import boundaries", () => {
  it("non-admin routes do not import admin cache/service-role clients or putCached helpers", async () => {
    const apiRoot = path.join(process.cwd(), "app/api");
    const routeFiles = await collectRouteFiles(apiRoot);
    const userFacingRoutes = routeFiles.filter((file) => !file.includes(`${path.sep}app${path.sep}api${path.sep}admin${path.sep}`));

    for (const file of userFacingRoutes) {
      const source = await readFile(file, "utf-8");

      expect(source).not.toMatch(/generatedAssetsAdmin/);
      expect(source).not.toMatch(/supabaseAdmin/);
      expect(source).not.toMatch(/\bputCached[A-Za-z0-9_]*\b/);
    }
  });
});

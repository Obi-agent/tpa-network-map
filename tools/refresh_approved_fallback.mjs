import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(projectRoot, "sheets_config.js");
const fallbackPath = path.join(projectRoot, "approved_sheets_fallback.js");
const syncPath = path.join(projectRoot, "google_sheets_sync.js");
const indexPath = path.join(projectRoot, "index.html");

const configSource = await readFile(configPath, "utf8");
const endpoint = configSource.match(/appsScriptUrl:\s*'([^']+)'/)?.[1];
if (!endpoint) throw new Error("Could not find the Apps Script URL in sheets_config.js.");

const payload = await fetchApprovedData(endpoint);
const approvedData = {
  providers: Array.isArray(payload.providers) ? payload.providers : [],
  categories: Array.isArray(payload.categories) ? payload.categories : [],
  changes: Array.isArray(payload.changes) ? payload.changes : [],
};
if (!approvedData.providers.length) {
  throw new Error("Approved provider feed returned no providers; fallback was not changed.");
}

const serialized = JSON.stringify(approvedData, null, 2);
await writeFile(fallbackPath, `window.providerSheetsFallbackData = ${serialized};\n`, "utf8");

const syncSource = await readFile(syncPath, "utf8");
const embeddedStart = "  const embeddedFallbackApprovedData = ";
const embeddedEnd = "\n\n  const fallbackApprovedData =";
const startIndex = syncSource.indexOf(embeddedStart);
const endIndex = syncSource.indexOf(embeddedEnd, startIndex);
if (startIndex === -1 || endIndex === -1) {
  throw new Error("Could not locate the embedded fallback block in google_sheets_sync.js.");
}
const nextSyncSource =
  syncSource.slice(0, startIndex) +
  `${embeddedStart}${serialized};` +
  syncSource.slice(endIndex);
await writeFile(syncPath, nextSyncSource, "utf8");

const version =
  process.argv[2] ||
  `${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-approved-fallback`;
const indexSource = await readFile(indexPath, "utf8");
const nextIndexSource = indexSource
  .replace(
    /approved_sheets_fallback\.js\?v=[^"]+/,
    `approved_sheets_fallback.js?v=${version}`,
  )
  .replace(
    /google_sheets_sync\.js\?v=[^"]+/,
    `google_sheets_sync.js?v=${version}`,
  );
await writeFile(indexPath, nextIndexSource, "utf8");

console.log(
  JSON.stringify(
    {
      providers: approvedData.providers.length,
      categories: approvedData.categories.length,
      changes: approvedData.changes.length,
      cacheVersion: version,
    },
    null,
    2,
  ),
);

async function fetchApprovedData(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${url}?action=data&cache=${Date.now()}-${attempt}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Approved provider feed returned HTTP ${response.status}.`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  throw lastError;
}

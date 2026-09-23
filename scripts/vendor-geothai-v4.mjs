import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const commit = "0594b8071094ac5c62e3e661612750df7c810df8";
const files = ["metadata.json", "geo.json", "postal_lookup.json"];
const outputDirectory = path.join(process.cwd(), "data", "geothai", "v4");

async function download(file) {
  const response = await fetch(`https://raw.githubusercontent.com/GeoThai/data/${commit}/data/v4/${file}`);
  if (!response.ok) throw new Error(`GeoThai download failed for ${file}: ${response.status}`);

  const body = await response.text();
  JSON.parse(body);
  return body;
}

await mkdir(outputDirectory, { recursive: true });
for (const file of files) {
  await writeFile(path.join(outputDirectory, file), `${await download(file)}\n`, "utf8");
}

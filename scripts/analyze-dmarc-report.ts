import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { analyzeDmarcReportFiles } from "../src/tooling/dmarc-report";

const main = async (): Promise<void> => {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    throw new Error("Provide at least one DMARC XML, gzip or zip file.");
  }
  const files = await Promise.all(
    paths.map(async (path) => ({
      data: await readFile(resolve(path)),
      name: basename(path),
    }))
  );
  const result = await analyzeDmarcReportFiles(files);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

if (import.meta.main) {
  try {
    await main();
  } catch {
    process.stderr.write("DMARC report analysis failed.\n");
    process.exitCode = 1;
  }
}

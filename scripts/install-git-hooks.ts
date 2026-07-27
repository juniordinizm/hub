import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { shouldInstallGitHooks } from "../src/lib/git-hooks-install-policy";

const isEnabled = (value: string | undefined): boolean =>
  Boolean(value && value !== "0" && value !== "false");

if (
  !shouldInstallGitHooks({
    ci: isEnabled(process.env.CI),
    gitMetadataExists: existsSync(".git"),
    vercel: isEnabled(process.env.VERCEL),
  })
) {
  console.log("Skipping Git hook installation outside a local checkout.");
  process.exit(0);
}

const lefthookCommand = resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "lefthook.exe" : "lefthook"
);
const installation = spawnSync(lefthookCommand, ["install"], {
  stdio: "inherit",
});
if (installation.error) {
  throw installation.error;
}
process.exit(installation.status ?? 1);

import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const standaloneDir = ".next/standalone";

if (existsSync(standaloneDir)) {
  await mkdir(`${standaloneDir}/.next`, { recursive: true });
  if (existsSync(".next/static")) {
    await cp(".next/static", `${standaloneDir}/.next/static`, { recursive: true });
  }
  if (existsSync("public")) {
    await cp("public", `${standaloneDir}/public`, { recursive: true });
  }
}

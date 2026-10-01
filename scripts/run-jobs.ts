import { runJobs } from "../src/lib/jobs/run";
import { db } from "../src/lib/db";

try {
  console.log(JSON.stringify(await runJobs(), null, 2));
} finally {
  await db.$disconnect();
}

// Lets Node scripts/tests import modules marked `import "server-only"` (Next.js enforces it in the app).
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(
  "export async function resolve(s, c, n) { if (s === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true }; return n(s, c); }",
));

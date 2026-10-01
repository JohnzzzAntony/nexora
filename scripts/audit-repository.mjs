import ts from "typescript";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative, extname, sep } from "node:path";
import { isBuiltin } from "node:module";

const root = process.cwd();
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(path);
  }
}
for (const directory of ["src", "scripts", "tests", "examples", "mini-services"]) walk(resolve(directory));
files.push(resolve("prisma/seed.ts"));
const config = ts.readConfigFile(resolve("tsconfig.json"), ts.sys.readFile).config;
const options = ts.parseJsonConfigFileContent(config, ts.sys, root).options;
const graph = new Map();
const missing = [];
const referencedPackages = new Set();
for (const file of files) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const dependencies = [];
  function visit(node) {
    let specifier;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === "require") && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
    if (specifier) {
      if (specifier.startsWith(".") || specifier.startsWith("@/")) {
        if (![".css", ".svg", ".png"].includes(extname(specifier))) {
          const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
          if (resolved) dependencies.push(resolve(resolved.resolvedFileName));
          else missing.push(`${relative(root, file)} -> ${specifier}`);
        }
      } else if (!isBuiltin(specifier)) {
        referencedPackages.add(specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  graph.set(file, dependencies);
}
const entries = files.filter(file => {
  const path = relative(root, file).split(sep).join("/");
  return !path.startsWith("src/") || /(^|\/)(page|layout|route|loading|error|not-found|global-error|template|default|forbidden|unauthorized|proxy|middleware|instrumentation)\.[jt]sx?$/.test(path) || path.endsWith(".d.ts");
});
const reachable = new Set();
function mark(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const dependency of graph.get(file) ?? []) mark(dependency);
}
entries.forEach(mark);
const visited = new Set();
const active = new Set();
const cycles = [];
function cycle(file, path = []) {
  if (active.has(file)) { cycles.push([...path, file].map(value => relative(root, value))); return; }
  if (visited.has(file)) return;
  active.add(file);
  for (const dependency of graph.get(file) ?? []) cycle(dependency, [...path, file]);
  active.delete(file);
  visited.add(file);
}
files.forEach(file => cycle(file));
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const declared = new Set([...Object.keys(manifest.dependencies), ...Object.keys(manifest.devDependencies)]);
const undeclared = [...referencedPackages].filter(name => !declared.has(name));
const unusedCandidates = files.filter(file => relative(root, file).startsWith(`src${sep}`) && !reachable.has(file)).map(file => relative(root, file));
console.log(JSON.stringify({ files: files.length, missingImports: missing, undeclaredPackages: undeclared, cycles, unusedSourceCandidates: unusedCandidates }, null, 2));
process.exitCode = missing.length || undeclared.length || cycles.length ? 1 : 0;

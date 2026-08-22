import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const cli = process.env.CCL_TREE_SITTER_CLI
  ?? resolve(root, "node_modules/.bin/tree-sitter");

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }).filter((path) => /\.(?:ccl|prg)$/.test(path));
}

function parse(path) {
  return spawnSync(cli, ["parse", path], { cwd: root, encoding: "utf8" });
}

function parseOutput(path) {
  const result = parse(path);
  return {
    result,
    output: `${result.stdout}\n${result.stderr}`,
  };
}

function hasParseError({ result, output }) {
  return result.status !== 0 || /\b(?:ERROR|MISSING)\b/.test(output);
}

let failed = false;
for (const path of filesBelow(join(root, "test/fixtures/positive"))) {
  const parsed = parseOutput(path);
  if (hasParseError(parsed)) {
    failed = true;
    console.error(`positive fixture failed: ${path}\n${parsed.output}`);
  }
}

const negativeDirectory = join(root, "test/fixtures/negative");
const expected = JSON.parse(readFileSync(join(negativeDirectory, "expected-errors.json"), "utf8"));
for (const [name, [row, column]] of Object.entries(expected)) {
  const path = join(negativeDirectory, name);
  const result = parse(path);
  const output = `${result.stdout}\n${result.stderr}`;
  const expectedStart = `(ERROR [${row}, ${column}]`;
  if (!output.includes(expectedStart)) {
    failed = true;
    console.error(`negative fixture did not fail at ${row}:${column}: ${path}\n${output}`);
  }
}

const directiveClasses = {
  required: [
    "INCLUDE", "I", "MODULE", "M", "PRINT", "P", "RUN", "R",
    "#DEFINE", "#DEF", "#IFDEF", "#IFNDEF", "#UNDEF",
  ],
  optional: ["DISPLAY", "D", "EDIT", "E", "LEDIT", "L", "OUTPUT", "O", "TERMINAL", "T"],
  none: [
    "BANNER", "B", "CLEAR", "C", "HELP", "H", "JOURNAL", "J",
    "KEDIT", "K", "SHOW", "S", "VERSION", "V", "Z", "#ELSE", "#ENDIF",
  ],
};

const temporaryDirectory = mkdtempSync(join(tmpdir(), "tree-sitter-ccl-directives-"));
let directiveCase = 0;
function checkDirective(name, source, shouldFail, assertion = () => true) {
  const path = join(temporaryDirectory, `${directiveCase++}-${name.replaceAll("#", "hash")}.ccl`);
  writeFileSync(path, source);
  const parsed = parseOutput(path);
  const didFail = hasParseError(parsed);
  if (didFail !== shouldFail || (!shouldFail && !assertion(parsed.output))) {
    failed = true;
    console.error(
      `directive matrix mismatch for ${name}: expected ${shouldFail ? "failure" : "success"}\n${parsed.output}`,
    );
  }
}

try {
  for (const name of directiveClasses.required) {
    checkDirective(name, `%${name} synthetic_argument\nGO\n`, false, (output) => (
      output.includes("(directive_arguments")
    ));
    checkDirective(name, `%${name}\nGO\n`, true);
    checkDirective(name, `%${name} ; comment is not an argument\nGO\n`, true);
  }
  for (const name of directiveClasses.optional) {
    checkDirective(name, `%${name}\nGO\n`, false);
    checkDirective(name, `%${name} synthetic_argument\nGO\n`, false, (output) => (
      output.includes("(directive_arguments")
    ));
  }
  for (const name of directiveClasses.none) {
    checkDirective(name, `%${name}\nGO\n`, false);
    checkDirective(name, `%${name} unexpected_argument\nGO\n`, true);
  }
  checkDirective(
    "INCLUDE-comment-boundary",
    "%INCLUDE synthetic.inc ; trailing comment\nGO\n",
    false,
    (output) => output.includes("(directive_arguments") && output.includes("(semicolon_comment"),
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

const semicolonPath = join(negativeDirectory, "semicolon-terminator.ccl");
const semicolonResult = parse(semicolonPath);
const semicolonOutput = `${semicolonResult.stdout}\n${semicolonResult.stderr}`;
const setCount = semicolonOutput.match(/\(set_statement\b/g)?.length ?? 0;
if (/\b(?:ERROR|MISSING)\b/.test(semicolonOutput)
    || !semicolonOutput.includes("(semicolon_comment")
    || setCount !== 1) {
  failed = true;
  console.error(`semicolon text was not treated exclusively as a comment: ${semicolonPath}\n${semicolonOutput}`);
}

if (failed) process.exit(1);

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const cli = process.env.CCL_TREE_SITTER_CLI
  ?? resolve(root, "node_modules/.bin/tree-sitter");
const nodeTypes = JSON.parse(readFileSync(resolve(root, "src/node-types.json"), "utf8"));

let failed = false;
const setOperation = nodeTypes.find((node) => node.type === "set_operation" && node.named);
const expectedFields = {
  left: ["select_query"],
  operator: ["set_operator"],
  right: ["select_query", "set_operation"],
};

if (!setOperation) {
  failed = true;
  console.error("generated node-types.json does not expose set_operation");
} else {
  for (const [name, expectedTypes] of Object.entries(expectedFields)) {
    const field = setOperation.fields?.[name];
    const actualTypes = field?.types?.map((type) => type.type).sort() ?? [];
    if (!field || field.multiple || !field.required
        || JSON.stringify(actualTypes) !== JSON.stringify([...expectedTypes].sort())) {
      failed = true;
      console.error(
        `set_operation.${name} is not one required coherent node: ${JSON.stringify(field)}`,
      );
    }
  }
}

for (const type of ["select_query", "set_operator"]) {
  if (!nodeTypes.some((node) => node.type === type && node.named)) {
    failed = true;
    console.error(`generated node-types.json does not expose named ${type}`);
  }
}

const query = resolve(root, "test/queries/set-operation-contract.scm");
const fixture = resolve(root, "test/fixtures/positive/set-operation-contract.ccl");
const result = spawnSync(cli, ["query", query, fixture], {
  cwd: root,
  encoding: "utf8",
});

if (result.status !== 0) {
  failed = true;
  console.error(`parser-contract query failed:\n${result.stdout}\n${result.stderr}`);
} else {
  const captures = [...result.stdout.matchAll(/capture:\s+(?:\d+\s+-\s+)?([^,]+)/g)]
    .map((match) => match[1]);
  for (const name of ["operation", "left", "operator", "right"]) {
    const count = captures.filter((capture) => capture === name).length;
    if (count !== 2) {
      failed = true;
      console.error(`expected 2 ${name} captures from nested set operations; got ${count}`);
    }
  }
}

if (failed) process.exit(1);

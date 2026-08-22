import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const queryDirectory = resolve(root, "../editors/zed/languages/ccl");
const fixture = resolve(root, "test/fixtures/positive/program.prg");
const highlightingFixture = resolve(root, "test/fixtures/positive/highlighting.ccl");
const cli = process.env.CCL_TREE_SITTER_CLI
  ?? resolve(root, "node_modules/.bin/tree-sitter");

if (!existsSync(queryDirectory)) {
  console.error(`Zed query directory not found: ${queryDirectory}`);
  process.exit(1);
}

let failed = false;
const queryNames = readdirSync(queryDirectory).filter((name) => name.endsWith(".scm"));
const requiredQueryNames = [
  "highlights.scm",
  "brackets.scm",
  "indents.scm",
  "outline.scm",
  "textobjects.scm",
];
for (const name of requiredQueryNames) {
  if (queryNames.includes(name)) continue;
  failed = true;
  console.error(`required Zed query file not found: ${resolve(queryDirectory, name)}`);
}
for (const name of queryNames) {
  const path = resolve(queryDirectory, name);
  const result = spawnSync(cli, ["query", path, fixture], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failed = true;
    console.error(`query failed to compile: ${path}\n${result.stdout}\n${result.stderr}`);
  }
}

if (!failed) {
  const highlights = resolve(queryDirectory, "highlights.scm");
  const result = spawnSync(cli, ["query", highlights, highlightingFixture], {
    cwd: root,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failed = true;
    console.error(
      `highlight behavior query failed: ${highlights}\n${result.stdout}\n${result.stderr}`,
    );
  } else {
    const captures = [];
    let pattern = null;
    for (const line of result.stdout.split("\n")) {
      const patternMatch = line.match(/^\s*pattern:\s+(\d+)\s*$/);
      if (patternMatch) {
        pattern = Number(patternMatch[1]);
        continue;
      }

      const captureMatch = line.match(
        /^\s*capture:\s+\d+\s+-\s+([^,]+), start: \((\d+), (\d+)\), end: \((\d+), (\d+)\), text: `([^`]*)`$/,
      );
      if (!captureMatch) continue;
      if (pattern === null) {
        failed = true;
        console.error(`highlight capture appeared without a pattern: ${line.trim()}`);
        continue;
      }
      captures.push({
        name: captureMatch[1],
        pattern,
        start: [Number(captureMatch[2]), Number(captureMatch[3])],
        end: [Number(captureMatch[4]), Number(captureMatch[5])],
        text: captureMatch[6],
      });
    }

    const source = readFileSync(highlightingFixture, "utf8");
    const sourceLines = source.split("\n");
    const spanOf = (text, occurrence = 0) => {
      let remaining = occurrence;
      for (let row = 0; row < sourceLines.length; row += 1) {
        let from = 0;
        while (from <= sourceLines[row].length) {
          const column = sourceLines[row].indexOf(text, from);
          if (column === -1) break;
          if (remaining === 0) {
            return { start: [row, column], end: [row, column + text.length], text };
          }
          remaining -= 1;
          from = column + Math.max(text.length, 1);
        }
      }
      throw new Error(`fixture occurrence not found: ${JSON.stringify(text)} #${occurrence + 1}`);
    };
    const samePoint = (left, right) => left[0] === right[0] && left[1] === right[1];
    const atSpan = (capture, span) => capture.text === span.text
      && samePoint(capture.start, span.start)
      && samePoint(capture.end, span.end);
    const identityKey = (capture) => [
      capture.name,
      capture.start.join(":"),
      capture.end.join(":"),
    ].join("@");
    const identities = new Map();
    for (const capture of captures) {
      const key = identityKey(capture);
      const identity = identities.get(key) ?? { ...capture, patterns: [] };
      identity.patterns.push(capture.pattern);
      identities.set(key, identity);
    }

    const exactCaptures = (name, span) => [...identities.values()].filter(
      (capture) => capture.name === name && atSpan(capture, span),
    );
    const requireExactCapture = (name, span) => {
      const matches = exactCaptures(name, span);
      if (matches.length === 1 && matches[0].patterns.length === 1) return matches[0];
      failed = true;
      const count = matches.reduce((total, match) => total + match.patterns.length, 0);
      console.error(
        `expected exactly one ${name} capture at ${span.start.join(":")}-${span.end.join(":")}`
          + ` for ${JSON.stringify(span.text)}; got ${count}`,
      );
      return matches[0];
    };
    const forbidExactCapture = (name, span) => {
      const matches = exactCaptures(name, span);
      if (matches.length === 0) return;
      failed = true;
      console.error(
        `unexpected ${name} capture at ${span.start.join(":")}-${span.end.join(":")}`
          + ` for ${JSON.stringify(span.text)}`,
      );
    };
    const requireAfter = (specialName, genericName, span) => {
      const specialized = exactCaptures(specialName, span);
      const generic = exactCaptures(genericName, span);
      if (specialized.length !== 1 || generic.length === 0) {
        failed = true;
        console.error(
          `cannot check query precedence for ${specialName} after ${genericName}`
            + ` at ${span.start.join(":")}-${span.end.join(":")}`,
        );
        return;
      }
      const specializedPattern = Math.min(...specialized[0].patterns);
      const latestGenericPattern = Math.max(...generic.flatMap((capture) => capture.patterns));
      if (specializedPattern > latestGenericPattern) return;
      failed = true;
      console.error(
        `${specialName} pattern ${specializedPattern} must follow ${genericName}`
          + ` pattern ${latestGenericPattern} for ${JSON.stringify(span.text)}`,
      );
    };

    const directiveSpans = [
      ["punctuation.special", spanOf("%", 0)],
      ["preproc", spanOf("BANNER")],
      ["punctuation.special", spanOf("%", 1)],
      ["preproc", spanOf("m")],
      ["string.special", spanOf("synthetic_module")],
      ["punctuation.special", spanOf("%", 2)],
      ["preproc", spanOf("#DEFINE")],
      ["string.special", spanOf("FEATURE_FLAG", 0)],
      ["punctuation.special", spanOf("%", 3)],
      ["preproc", spanOf("#IFDEF")],
      ["string.special", spanOf("FEATURE_FLAG", 1)],
      ["punctuation.special", spanOf("%", 4)],
      ["preproc", spanOf("#ENDIF")],
    ];
    for (const [name, span] of directiveSpans) requireExactCapture(name, span);

    const builtinSpans = ["cNvTiNt", "UaR_GeT_CoDe_DiSpLaY", "CuRpRoG", "RoUnD"]
      .map((text) => spanOf(text));
    for (const span of builtinSpans) {
      requireExactCapture("function.builtin", span);
      requireAfter("function.builtin", "function", span);
    }

    const customFunction = spanOf("custom_function");
    requireExactCapture("function", customFunction);
    forbidExactCapture("function.builtin", customFunction);
    requireAfter("function", "variable", customFunction);

    const curProg = spanOf("CuRpRoG");
    const curQual = spanOf("CuRqUaL");
    const trueLiteral = spanOf("TrUe");
    for (const span of [curProg, curQual]) {
      requireExactCapture("variable.special", span);
      requireAfter("variable.special", "variable", span);
    }
    requireExactCapture("variable.special", trueLiteral);
    requireAfter("variable.special", "boolean", trueLiteral);

    const dummyExpression = spanOf("DuMmYt", 0);
    const dummyTables = [spanOf("DuMmYt", 1), spanOf("DuMmYt", 2)];
    forbidExactCapture("type.builtin", dummyExpression);
    for (const span of dummyTables) {
      requireExactCapture("type.builtin", span);
      requireAfter("type.builtin", "type", span);
    }

    for (const keyword of ["UNION", "ALL", "MINUS", "INTERSECT", "COMMIT", "ROLLBACK"]) {
      requireExactCapture("keyword", spanOf(keyword));
    }
  }
}

if (failed) process.exit(1);

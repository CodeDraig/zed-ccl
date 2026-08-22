# CCL for Zed

Language support for modern Cerner Command Language (CCL) in
[Zed](https://zed.dev/), backed by a structured Tree-sitter grammar.

The extension recognizes `.ccl` and `.prg` files and provides:

- Syntax highlighting for CCL programs, queries, ReportWriter sections,
  directives, comments, literals, reserved variables, and documented built-in
  functions.
- Syntax-aware indentation and semicolon comment toggling.
- Bracket matching, outlines, and text objects.
- Structured parsing for declarations, records, subroutines, control flow,
  queries, set operations, DML, transactions, and ReportWriter constructs.

The grammar targets currently documented CCL 9.05+ syntax. It intentionally
does not preserve permissive or malformed behavior from legacy editor
grammars: completed unsupported syntax remains visible as a Tree-sitter error.

## Install as a Zed development extension

The current manifest uses Zed's local `file://` grammar repository mechanism.
Before installing from a different checkout location, update the grammar
repository in `editors/zed/extension.toml` to the absolute path of that clone
and pin `rev` to the parser commit you want Zed to build.

1. Open Zed or Zed Preview.
2. Run `zed: install dev extension` from the command palette.
3. Select the `editors/zed` directory from this repository.
4. Open a `.ccl` or `.prg` file and confirm that the language selector shows
   **CCL**.

If the parser revision changes, reinstall the development extension so Zed
rebuilds its ignored local grammar cache.

## Development

The Zed wrapper lives under `editors/zed/`. The Tree-sitter grammar, scanner,
generated parser sources, corpus, and fixtures live under `tree-sitter-ccl/`.

Use Node.js 22 and run the parser validation suite with:

```sh
cd tree-sitter-ccl
npm install
npm run check
npm run check:generated
```

`npm run check` regenerates the parser, runs the exact-tree corpus, checks all
positive and negative fixtures, validates the stable parser node contract, and
compiles the Zed queries with their capture assertions.

See [`docs/syntax-sources.md`](docs/syntax-sources.md) for the evidence ledger
that maps implemented constructs to Oracle documentation and tests.

## Scope

This project provides grammar-based editor support only. It does not include
an LSP, formatter, CCL execution integration, or semantic validation of
Millennium tables, columns, code sets, and PLAN relationships.

## Acknowledgments

Thanks to **Justin J. Clark** and the contributors to the original
[`CodeDraig/vscode-ccl`](https://github.com/CodeDraig/vscode-ccl) Visual Studio
Code extension. Its TextMate grammar and project history helped identify CCL
constructs worth investigating while this parser was being developed.

The Tree-sitter grammar in this repository was implemented independently
against current Oracle Health documentation. The original VS Code grammar was
used as a source of leads, not as a syntax or compatibility contract.

## License

MIT. See [`editors/zed/LICENSE`](editors/zed/LICENSE) and
[`tree-sitter-ccl/LICENSE`](tree-sitter-ccl/LICENSE).

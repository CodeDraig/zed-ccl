# tree-sitter-ccl

A structured Tree-sitter grammar for modern Cerner Command Language (CCL),
targeting the currently documented 9.05+ language. It is the parser used by
the sibling Zed development extension.

The original VS Code TextMate grammar is not an input contract. In particular,
this parser does not preserve SQL-shaped aliases, reversed declarations,
semicolon terminators, or permissive token fallback. Unsupported complete
syntax is expected to remain visible as an `ERROR` node.

## Development

```sh
npm install
npm run generate
npm test
npm run parse:fixtures
npm run check:queries
```

`npm run check:generated` regenerates the C parser and fails if committed files
under `src/` drift. Zed consumes the generated `src/parser.c` and
`src/scanner.c`; it does not run `tree-sitter generate` itself.

Positive fixtures must parse without `ERROR` or `MISSING`. Negative fixtures
are listed in `test/fixtures/negative/expected-errors.json` and must contain a
syntax error. Corpus tests assert concrete syntax trees for individual language
areas.

## Deliberate boundaries

The grammar recognizes syntax, not Millennium catalog semantics. It does not
verify tables, columns, code sets, parameter values, PLAN alias cardinality, or
the declared byte count of `@length:string@` literals. Classes, hash maps,
uncommon UAR/SQL package declarations, OLAP/PIVOT, uncommon DDL, and legacy-only
forms are outside the initial grammar.

See `../docs/syntax-sources.md` for the repository-wide evidence and test map.

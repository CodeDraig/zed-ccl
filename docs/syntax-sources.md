# CCL Syntax Evidence Ledger

This ledger records the syntax sources used by the Tree-sitter CCL grammar. It
is a traceability aid, not a copy of Oracle documentation. All test programs in
this repository are synthetic and must contain no customer data or copied
Oracle examples.

## Authority and baseline

- Parser baseline: Discern Explorer / CCL 9.05 and later.
- Primary authority: current Oracle Health **Discern Help Pages** and the
  current Discern Explorer language requirements page.
- Secondary aids: the local Cerner CCL skill references, the retained legacy
  EBNF and Pygments lexer, and the historical VS Code grammar and samples.
  Secondary material can identify a construct to research, but cannot make a
  construct valid or override the primary source.
- A Help page that gives no minimum release is treated as current syntax only
  while it remains published in Discern Help Pages and has no stated removal.
- The parser checks syntax shape only. It does not prove that a program
  compiles against a Millennium domain, that table or column names exist, or
  that PLAN and DML operations are semantically safe.

The broad baseline is cross-checked against [Discern Explorer Language, page
2103810771](https://wiki.cerner.com/pages/viewpage.action?pageId=2103810771),
updated 2026-03-16. That page is a requirements inventory rather than a
command grammar, so command-specific Help pages remain the direct evidence.

## Implemented syntax map

Paths under `tree-sitter-ccl/test/corpus/` name the exact-tree corpus. A row is not
complete until its corpus passes and positive fixtures parse without
unexpected `ERROR` or `MISSING` nodes.

| Construct | Primary Oracle evidence | 9.05+ applicability | Parser rules | Corpus |
| --- | --- | --- | --- | --- |
| Case-insensitive commands; case-sensitive string data; whitespace; `GO`; commas and parentheses | [Syntax Rules, 23339022](https://wiki.cerner.com/pages/viewpage.action?pageId=23339022), updated 2022-10-17 | Current general rules; `GO` terminates an interactive command or the complete `CREATE PROGRAM`, not each statement inside a program | `source_file`, `go_command`, keyword tokens | `lexical.txt`, `programs.txt` |
| Semicolon, first-column bang, and non-nested block comments; backslash continuation | [Comments, 23338785](https://wiki.cerner.com/pages/viewpage.action?pageId=23338785); [Syntax Rules, 23339022](https://wiki.cerner.com/pages/viewpage.action?pageId=23339022) | Current; the scanner preserves a semicolon after directive arguments as a comment, and the syntax page explicitly discusses 9.05 continuation-listing behavior | external scanner tokens and `block_comment` | `lexical.txt`, `errors.txt`, directive fixtures |
| Single, double, caret, tilde, bar, and length-prefixed strings | [Syntax Rules, 23339022](https://wiki.cerner.com/pages/viewpage.action?pageId=23339022) | Current; parser recognizes the length prefix but deliberately does not count characters | external `string_literal` | `lexical.txt` |
| Integer, real, and `.W` numeric forms | [Syntax Rules, 23339022](https://wiki.cerner.com/pages/viewpage.action?pageId=23339022) | `.W` is documented from 8.13, therefore in the 9.05+ baseline | numeric literal rules | `lexical.txt`, `expressions.txt` |
| `DROP PROGRAM`, `CREATE PROGRAM`, final `END GO` | [CREATE PROGRAM, 23338594](https://wiki.cerner.com/pages/viewpage.action?pageId=23338594); [Syntax Rules, 23339022](https://wiki.cerner.com/pages/viewpage.action?pageId=23339022) | Current Help syntax; no older-only form is accepted for compatibility | `drop_program_statement`, `program_definition`, `go_command` | `programs.txt` |
| First-column percent directives, documented argument arity, full names, one-letter aliases, conditional macro directives, and program labels | [Using Directives, 23339098](https://wiki.cerner.com/pages/viewpage.action?pageId=23339098); [%DEFINE, 23338304](https://wiki.cerner.com/pages/viewpage.action?pageId=23338304); [%INCLUDE, 23338315](https://wiki.cerner.com/pages/viewpage.action?pageId=23338315); [%MODULE, 23338319](https://wiki.cerner.com/pages/viewpage.action?pageId=23338319); [Label Directive, 23339052](https://wiki.cerner.com/pages/viewpage.action?pageId=23339052), updated 2026-07-09 | Current; `%#DEF` is the documented short form of `%#DEFINE`; required, optional, and no-argument forms are distinct; unsupported names and invalid arity remain errors; `$DIR` and `$OS_Command` are outside the percent-directive grammar; labels are program-only | `directive`, scanner-classified directive-name externals aliased to `directive_name`, `directive_arguments`, `label_directive`, `goto_statement` | `lexical.txt`, `programs.txt`, `reportwriter.txt`, full directive matrix and negative fixtures |
| `PROMPT` values, `WITH` bindings, named parameters, and positional parameters `$1` through `$99` | [Defining Prompts, 23338646](https://wiki.cerner.com/pages/viewpage.action?pageId=23338646); [Using Run-Time Parameters, 23339004](https://wiki.cerner.com/pages/viewpage.action?pageId=23339004) | Current Help syntax; `$0`, `$00`, and `$100` are rejected and prompt runtime validation is outside parser scope | `prompt_statement`, `prompt_item`, `prompt_with_clause`, `prompt_parameter` | `programs.txt`, `expressions.txt`, negative fixtures |
| Scalar, array, and callable declarations; declaration options and data types | [DECLARE, 23338634](https://wiki.cerner.com/pages/viewpage.action?pageId=23338634), updated 2024-11-26 | Current; the supported order is `DECLARE name = type`, not SQL-like or legacy guesses | `declaration`, `variable_declaration`, `array_declaration`, `subroutine_declaration`, `data_type` | `declarations.txt`, `errors.txt` |
| Record definitions, nested/list fields, and `FREE RECORD` | [Record Structures, 23338904](https://wiki.cerner.com/pages/viewpage.action?pageId=23338904); [RECORD, 23338905](https://wiki.cerner.com/pages/viewpage.action?pageId=23338905); [FREE RECORD, 23338750](https://wiki.cerner.com/pages/viewpage.action?pageId=23338750) | Current Help syntax; allocation, field type compatibility, and list sizing are semantic | `record_definition`, `record_field`, `record_extent`, `free_record_statement` | `declarations.txt`, `programs.txt` |
| Subroutine declaration/definition, typed parameters, return type, and `RETURN` | [SUBROUTINE, 23339016](https://wiki.cerner.com/pages/viewpage.action?pageId=23339016), updated 2024-11-25; [RETURN, 1326109526](https://wiki.cerner.com/pages/viewpage.action?pageId=1326109526) | Current Help syntax; argument type compatibility is semantic | `subroutine_declaration`, `subroutine_definition`, `parameter_list`, `return_statement` | `declarations.txt`, `programs.txt` |
| `SET`, direct ReportWriter assignment, `CALL`, and `EXECUTE` | [SET Commands, 23338963](https://wiki.cerner.com/pages/viewpage.action?pageId=23338963); [CALL Commands, 23338382](https://wiki.cerner.com/pages/viewpage.action?pageId=23338382); [EXECUTE, 23338712](https://wiki.cerner.com/pages/viewpage.action?pageId=23338712) | Current command families; specific command/function signatures are not hard-coded | `set_statement`, `reportwriter_assignment`, `call_statement`, `execute_statement` | `programs.txt`, `reportwriter.txt` |
| `COMMIT` and `ROLLBACK` | [COMMIT, 23338578](https://wiki.cerner.com/pages/viewpage.action?pageId=23338578); [ROLLBACK, 23338927](https://wiki.cerner.com/pages/viewpage.action?pageId=23338927) | Published current Help syntax; transaction semantics are outside parser scope | `commit_statement`, `rollback_statement` | `control-flow.txt`, positive fixtures |
| `IF`/`ELSEIF`/`ELSE`, `CASE`, `FOR`, and `WHILE` blocks | [IF, 23338782](https://wiki.cerner.com/pages/viewpage.action?pageId=23338782); [CASE, 23338406](https://wiki.cerner.com/pages/viewpage.action?pageId=23338406), updated 2025-03-18; [FOR, 23338748](https://wiki.cerner.com/pages/viewpage.action?pageId=23338748); [WHILE, 23339124](https://wiki.cerner.com/pages/viewpage.action?pageId=23339124) | Published current Help syntax | `if_statement`, `elseif_clause`, `case_statement`, `for_statement`, `while_statement` | `control-flow.txt` |
| `SELECT`, CCL selection aliases (`alias = expression`), `INTO`, `FROM`, `WHERE`, grouping, ordering, `HAVING`, and `WITH` options | [SELECT, 23338958](https://wiki.cerner.com/pages/viewpage.action?pageId=23338958); [SELECT Expressions, 23338946](https://wiki.cerner.com/pages/viewpage.action?pageId=23338946); [Control Options, 23338583](https://wiki.cerner.com/pages/viewpage.action?pageId=23338583) | Current Help syntax; SQL-style `expression AS alias` is not accepted without direct current CCL evidence | `select_statement` and its clause/item rules | `queries.txt`, `errors.txt` |
| `UNION`, `UNION ALL`, `MINUS`, and `INTERSECT` with parenthesized right operands and outer ordering, ReportWriter, and options | [Set Operators, 1202628354](https://wiki.cerner.com/pages/viewpage.action?pageId=1202628354), updated 2026-02-18 | Current; each operation exposes singular named `left`, `operator`, and `right` fields; embedded queries use the documented restricted shape and semantic data-type compatibility is outside parser scope | `set_operation`, `select_query`, `set_operator`, `select_statement` | `queries.txt`, parser-contract query, positive and negative fixtures |
| `PLAN`, `JOIN`, `ORJOIN`, and `OUTERJOIN()` call syntax | [JOIN Options, 23338804](https://wiki.cerner.com/pages/viewpage.action?pageId=23338804), updated 2025-06-17 | Current; table count, alias relationships, and PLAN quality are semantic and not enforced | `plan_clause`, `join_clause`, ordinary `call_expression` | `queries.txt` |
| Parenthesized ANSI `INNER`, `LEFT`, `RIGHT`, and `FULL JOIN ... ON` entries | [ANSI JOIN, 3373638280](https://wiki.cerner.com/pages/viewpage.action?pageId=3373638280), updated 2025-06-16 | Directly documented current syntax; it cannot be mixed with `OUTERJOIN()` in one query, which is a semantic validation gap | `ansi_join`, `from_item` | `queries.txt` |
| Subqueries, `EXISTS`, `IN`, `BETWEEN`, calls, members, subscripts, namespaces, and operator precedence | [SELECT Expressions, 23338946](https://wiki.cerner.com/pages/viewpage.action?pageId=23338946); [Arithmetic Operators, 23338351](https://wiki.cerner.com/pages/viewpage.action?pageId=23338351); [Relational Operators, 23338910](https://wiki.cerner.com/pages/viewpage.action?pageId=23338910); [Syntax Rules, 23339022](https://wiki.cerner.com/pages/viewpage.action?pageId=23339022) | Current expression families; built-in names remain ordinary identifiers so user functions are not rejected | expression hierarchy and postfix/call rules | `expressions.txt`, `queries.txt` |
| Bare `SEQ` versus `seq(...)` | [SELECT, 23338958](https://wiki.cerner.com/pages/viewpage.action?pageId=23338958) plus current command/function references | Parser-level distinction only; no function-name allowlist | `pseudo_column`, `call_expression` | `expressions.txt` |
| ReportWriter sections, `%MODULE`, `ROW`, `COL`, `BREAK`, calls, assignments, and procedural control-flow entries | [Reportwriter Syntax, 23338922](https://wiki.cerner.com/pages/viewpage.action?pageId=23338922); [Select Expressions in Reportwriter, 23338945](https://wiki.cerner.com/pages/viewpage.action?pageId=23338945); [%MODULE, 23338319](https://wiki.cerner.com/pages/viewpage.action?pageId=23338319) | Published current Help syntax; `%MODULE` is accepted as a structured ReportWriter item without broadening directives into runtime control-flow bodies; output-device and layout effects are runtime behavior | `reportwriter_section`, `directive`, and ReportWriter item rules | `reportwriter.txt`, positive fixture |
| `INSERT`, `UPDATE`, and `DELETE` | [INSERT, 23338793](https://wiki.cerner.com/pages/viewpage.action?pageId=23338793); [UPDATE, 23339083](https://wiki.cerner.com/pages/viewpage.action?pageId=23339083); [DELETE, 23338647](https://wiki.cerner.com/pages/viewpage.action?pageId=23338647) | Published current Help syntax; parser tests use invented tables and never execute DML | `insert_statement`, `update_statement`, `delete_statement` | `dml.txt` |
| `MERGE`, matched update, and not-matched insert | [MERGE, 23338831](https://wiki.cerner.com/pages/viewpage.action?pageId=23338831), updated 2024-04-29 | Current Help syntax; execution safety and database semantics are outside scope | `merge_statement`, `merge_matched_clause`, `merge_not_matched_clause` | `dml.txt` |

## Zed highlighting evidence

These entries affect editor captures only. They do not reserve identifiers or
restrict which functions, variables, or tables the parser accepts.

| Highlighted construct | Primary Oracle evidence | Implementation | Validation |
| --- | --- | --- | --- |
| Reserved variables | [Reserved Variables, 23338923](https://wiki.cerner.com/pages/viewpage.action?pageId=23338923), updated 2025-02-19 | Case-insensitive `@variable.special` predicate in `highlights.scm` | `test/fixtures/positive/highlighting.ccl`; `scripts/check-queries.mjs` |
| Built-in functions and verified UAR functions | [Functions Reference, 23338755](https://wiki.cerner.com/pages/viewpage.action?pageId=23338755); [HHFUNCTIONS, 927335181](https://wiki.cerner.com/pages/viewpage.action?pageId=927335181), updated 2025-11-21; [User Access Routine Help, 1577326329](https://wiki.cerner.com/pages/viewpage.action?pageId=1577326329) | Case-insensitive `@function.builtin` predicates; call-expression grammar remains unrestricted | `test/fixtures/positive/highlighting.ccl`; `scripts/check-queries.mjs` |
| `DUMMYT` in table positions | [Using the DUMMYT Table, 23339106](https://wiki.cerner.com/pages/viewpage.action?pageId=23339106) | Table-field-only `@type.builtin` predicates | `test/fixtures/positive/highlighting.ccl`; `scripts/check-queries.mjs` |

The reserved-variable table repeats `CURNETDOMAIN`; its prose explicitly
references `CURNETDOMAINID`, so both names are highlighted and the source defect
is preserved here. The Functions Reference Markdown rendering omits link-only
entries; the committed allowlist was normalized from the raw page index, with
navigation topics excluded and the seven UAR names confirmed from the linked
current catalogs.

## Deliberate limits and open evidence gaps

- **Not implemented in this release:** classes, hash maps, uncommon UAR/SQL
  package declarations, OLAP/PIVOT, uncommon DDL, execution integration, an
  LSP, formatting, and Millennium catalog validation.
- **No permissive fallback:** an unsupported complete construct must remain an
  `ERROR`; the grammar must not add an `unknown_statement` rule to hide gaps.
- **Semantic constraints not enforced:** label placement, mixing ANSI joins
  with `OUTERJOIN()`, PLAN completeness, alias resolution, declaration and
  argument type compatibility, record extent correctness, DML safety, and
  ReportWriter section ordering/runtime behavior require a CCL compiler or
  later semantic tooling.
- **No compiler corpus claim:** the current validation corpus is synthetic and
  source-derived. Passing Tree-sitter tests proves parser behavior, not Oracle
  compiler acceptance.
- **Unverified forms stay rejected:** SQL-style selection aliases, nested block
  comments, semicolon statement terminators, legacy declaration ordering, and
  undocumented spelling variants must not be accepted for parity with the old
  VS Code highlighter.
- **Version-specific additions:** syntax introduced after 9.05 must be added
  only with a source that states its release availability, a dedicated corpus
  case, and an update to this ledger.

## Secondary references consulted

The local `cerner-ccl` skill references were used to locate likely syntax and
known CCL-versus-SQL hazards. The retained `reference/*.ebnf` files and
Pygments lexer, along with the historical TextMate grammar and old samples,
are intentionally non-authoritative; some contain guesses or malformed
examples. None is a compatibility contract.

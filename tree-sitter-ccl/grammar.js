/*
 * Tree-sitter grammar for modern Cerner Command Language (CCL).
 *
 * This grammar intentionally models documented CCL structure. It does not
 * contain an "unknown statement" escape hatch: unsupported complete syntax
 * should remain visible as an ERROR node.
 */

const PREC = {
  OR: 1,
  AND: 2,
  NOT: 3,
  COMPARE: 4,
  CONCAT: 5,
  ADD: 6,
  MULTIPLY: 7,
  POWER: 8,
  UNARY: 9,
  POSTFIX: 10,
  CALL: 11,
};

module.exports = grammar({
  name: "ccl",

  externals: ($) => [
    $.semicolon_comment,
    $.bang_comment,
    $.directive_marker,
    $.required_directive_name,
    $.optional_directive_name,
    $.no_argument_directive_name,
    $.directive_arguments,
    $.line_continuation,
    $.string_literal,
  ],

  extras: ($) => [
    /[\s\uFEFF\u2060\u200B]/,
    $.line_continuation,
    $.semicolon_comment,
    $.bang_comment,
    $.block_comment,
  ],

  word: ($) => $.identifier,

  rules: {
    source_file: ($) => repeat($._top_level_item),

    _top_level_item: ($) => choice(
      $.directive,
      $.go_command,
      $.drop_program_statement,
      $.program_definition,
      $.prompt_statement,
      $.declaration,
      $.record_definition,
      $.subroutine_definition,
      $._statement,
    ),

    // Discern Explorer batches and compiled programs.
    go_command: ($) => kw("go"),

    directive: ($) => choice(
      seq(
        field("marker", $.directive_marker),
        field("name", alias($.required_directive_name, $.directive_name)),
        field("arguments", $.directive_arguments),
      ),
      seq(
        field("marker", $.directive_marker),
        field("name", alias($.optional_directive_name, $.directive_name)),
        optional(field("arguments", $.directive_arguments)),
      ),
      seq(
        field("marker", $.directive_marker),
        field("name", alias($.no_argument_directive_name, $.directive_name)),
      ),
    ),

    drop_program_statement: ($) => seq(
      kw("drop"),
      kw("program"),
      field("name", $.qualified_identifier),
    ),

    program_definition: ($) => seq(
      kw("create"),
      kw("program"),
      field("name", $.qualified_identifier),
      repeat(choice(
        $.directive,
        $.label_directive,
        $.prompt_statement,
        $.declaration,
        $.record_definition,
        $.subroutine_definition,
        $._statement,
      )),
      kw("end"),
    ),

    label_directive: ($) => seq("#", field("name", $.identifier)),

    prompt_statement: ($) => seq(
      kw("prompt"),
      commaSep1($.prompt_item),
      optional($.prompt_with_clause),
    ),

    prompt_item: ($) => seq(
      field("label", $.string_literal),
      "=",
      field("default", $._expression),
    ),

    prompt_with_clause: ($) => seq(
      kw("with"),
      commaSep1(field("binding", $.identifier)),
    ),

    // Declarations, arrays, records, and subroutines.
    declaration: ($) => choice(
      $.variable_declaration,
      $.array_declaration,
      $.subroutine_declaration,
    ),

    variable_declaration: ($) => seq(
      kw("declare"),
      field("name", $.qualified_identifier),
      "=",
      field("type", $.data_type),
      optional($.declaration_options),
    ),

    array_declaration: ($) => seq(
      kw("declare"),
      field("name", $.qualified_identifier),
      "[",
      commaSep1(field("extent", $.integer_literal)),
      "]",
      "=",
      field("type", $.data_type),
      optional($.declaration_options),
    ),

    subroutine_declaration: ($) => seq(
      kw("declare"),
      field("name", $.qualified_identifier),
      $.parameter_list,
      "=",
      field("return_type", $.data_type),
      optional($.declaration_options),
    ),

    declaration_options: ($) => seq(
      kw("with"),
      commaSep1($.declaration_option),
    ),

    declaration_option: ($) => choice(
      seq(choice(kw("constant"), kw("noconstant")), "(", commaSep($._expression), ")"),
      kw("public"),
      kw("private"),
      kw("protect"),
      kw("privateprotect"),
      kw("persist"),
      kw("nopersist"),
      kw("persistscript"),
      kw("copy"),
    ),

    data_type: ($) => token(choice(
      /[cC][1-9][0-9]*/,
      /[vV][cC]/,
      /[dD][mM](?:12|14)/,
      /[dD][qQ]8/,
      /[fF][48]/,
      /[uU]?[iI][124]/,
      /[wW]8/,
      /[hH]/,
      /[nN][0-9]+(?:\.[0-9]+)?/,
      /[pP][0-9]+(?:\.[0-9]+)?/,
    )),

    record_definition: ($) => seq(
      kw("record"),
      field("name", $.qualified_identifier),
      "(",
      repeat1($.record_field),
      ")",
      optional(seq(kw("with"), $.scope_option)),
    ),

    record_field: ($) => seq(
      field("level", $.integer_literal),
      field("name", $.identifier),
      optional($.record_extent),
      optional(seq("=", field("type", $.data_type))),
    ),

    record_extent: ($) => seq(
      "[",
      choice("*", commaSep1($.integer_literal)),
      "]",
    ),

    scope_option: ($) => choice(
      kw("public"),
      kw("private"),
      kw("protect"),
      kw("privateprotect"),
    ),

    parameter_list: ($) => seq("(", commaSep($.parameter), ")"),

    parameter: ($) => seq(
      field("name", $.identifier),
      "=",
      field("type", $.data_type),
      optional(seq(
        "(",
        choice(kw("ref"), kw("value")),
        optional(seq(",", field("default", $._expression))),
        ")",
      )),
    ),

    subroutine_definition: ($) => seq(
      kw("subroutine"),
      "(",
      field("name", $.qualified_identifier),
      $.parameter_list,
      "=",
      field("return_type", $.data_type),
      optional($.declaration_options),
      ")",
      repeat(choice($.declaration, $.record_definition, $._statement)),
      kw("end"),
    ),

    // Executable commands.
    _statement: ($) => choice(
      $.set_statement,
      $.call_statement,
      $.execute_statement,
      $.return_statement,
      $.free_record_statement,
      $.if_statement,
      $.case_statement,
      $.for_statement,
      $.while_statement,
      $.goto_statement,
      $.commit_statement,
      $.rollback_statement,
      $.select_statement,
      $.insert_statement,
      $.update_statement,
      $.delete_statement,
      $.merge_statement,
    ),

    set_statement: ($) => seq(
      kw("set"),
      field("target", $.assignable_expression),
      field("operator", choice("=", "+=", "-=", "*=", "/=")),
      field("value", $._expression),
    ),

    call_statement: ($) => seq(kw("call"), field("function", $.call_expression)),

    execute_statement: ($) => prec.right(seq(
      kw("execute"),
      field("program", choice($.qualified_identifier, $.string_literal)),
      optional(seq(optional(kw("with")), commaSep1($._expression))),
    )),

    return_statement: ($) => seq(
      kw("return"),
      optional(seq("(", optional($._expression), ")")),
    ),

    free_record_statement: ($) => seq(
      kw("free"),
      kw("record"),
      field("name", $.qualified_identifier),
    ),

    goto_statement: ($) => seq(kw("go"), kw("to"), field("label", $.identifier)),

    commit_statement: ($) => kw("commit"),

    rollback_statement: ($) => kw("rollback"),

    if_statement: ($) => seq(
      kw("if"),
      parenthesized($._expression),
      repeat(choice($.declaration, $._statement)),
      repeat($.elseif_clause),
      optional($.else_clause),
      kw("endif"),
    ),

    elseif_clause: ($) => seq(
      kw("elseif"),
      parenthesized($._expression),
      repeat(choice($.declaration, $._statement)),
    ),

    else_clause: ($) => seq(
      kw("else"),
      repeat(choice($.declaration, $._statement)),
    ),

    case_statement: ($) => seq(
      kw("case"),
      parenthesized($._expression),
      repeat1($.case_arm),
      optional($.case_else),
      kw("endcase"),
    ),

    case_arm: ($) => seq(
      kw("of"),
      commaSep1($._expression),
      ":",
      repeat1($._statement),
    ),

    case_else: ($) => seq(kw("else"), optional(":"), repeat1($._statement)),

    for_statement: ($) => seq(
      kw("for"),
      "(",
      field("variable", $.assignable_expression),
      "=",
      field("start", $._expression),
      kw("to"),
      field("end", $._expression),
      optional(seq(kw("by"), field("increment", $._expression))),
      ")",
      repeat(choice($.declaration, $._statement)),
      kw("endfor"),
    ),

    while_statement: ($) => seq(
      kw("while"),
      parenthesized($._expression),
      repeat(choice($.declaration, $._statement)),
      kw("endwhile"),
    ),

    // SELECT and ReportWriter.
    select_statement: ($) => seq(
      choice($.select_query, $.set_operation),
      optional($.order_by_clause),
      repeat($.reportwriter_section),
      optional($.select_options),
    ),

    set_operation: ($) => seq(
      field("left", $.select_query),
      field("operator", $.set_operator),
      "(",
      field("right", choice(
        alias($._embedded_select_query, $.select_query),
        alias($._embedded_set_operation, $.set_operation),
      )),
      ")",
    ),

    _embedded_set_operation: ($) => seq(
      field("left", alias($._embedded_select_query, $.select_query)),
      field("operator", $.set_operator),
      "(",
      field("right", choice(
        alias($._embedded_select_query, $.select_query),
        alias($._embedded_set_operation, $.set_operation),
      )),
      ")",
    ),

    set_operator: ($) => choice(
      seq(kw("union"), optional(kw("all"))),
      kw("minus"),
      kw("intersect"),
    ),

    select_query: ($) => seq(
      kw("select"),
      optional(kw("distinct")),
      optional($.into_clause),
      commaSep1($.selection_item),
      $.from_clause,
      optional(choice($.where_clause, $.plan_clause)),
      optional($.group_by_clause),
      optional($.having_clause),
    ),

    _embedded_select_query: ($) => seq(
      kw("select"),
      optional(kw("distinct")),
      optional($.into_clause),
      commaSep1($.selection_item),
      $.from_clause,
      optional($.where_clause),
      optional($.group_by_clause),
      optional($.having_clause),
    ),

    into_clause: ($) => seq(kw("into"), field("destination", $._expression)),

    selection_item: ($) => choice($.selection_alias, $._expression),

    selection_alias: ($) => prec(2, seq(
      field("alias", $.identifier),
      "=",
      field("value", $._expression),
    )),

    from_clause: ($) => seq(kw("from"), commaSep1($.from_item)),

    from_item: ($) => choice(
      $.table_reference,
      $.table_control_reference,
      $.derived_table,
      $.ansi_join,
    ),

    table_reference: ($) => prec.right(seq(
      field("table", $.qualified_identifier),
      optional(field("alias", $.identifier)),
    )),

    table_control_reference: ($) => seq(
      "(",
      field("table", $.qualified_identifier),
      optional(field("alias", $.identifier)),
      $.table_with_clause,
      ")",
    ),

    table_with_clause: ($) => seq(
      kw("with"),
      commaSep1($.control_option),
    ),

    derived_table: ($) => seq(
      "(",
      $.select_statement,
      ")",
      field("alias", $.identifier),
    ),

    ansi_join: ($) => seq(
      "(",
      optional(choice(kw("left"), kw("right"), kw("full"), kw("inner"))),
      kw("join"),
      field("table", $.table_reference),
      kw("on"),
      parenthesized($._expression),
      ")",
    ),

    where_clause: ($) => seq(kw("where"), $._expression),

    plan_clause: ($) => seq(
      kw("plan"),
      field("alias", $.identifier),
      optional($.where_clause),
      repeat($.join_clause),
    ),

    join_clause: ($) => seq(
      choice(kw("join"), kw("orjoin")),
      field("alias", $.identifier),
      optional($.where_clause),
    ),

    group_by_clause: ($) => seq(kw("group"), kw("by"), commaSep1($._expression)),
    having_clause: ($) => seq(kw("having"), $._expression),

    order_by_clause: ($) => seq(
      kw("order"),
      kw("by"),
      commaSep1($.order_item),
    ),

    order_item: ($) => seq($._expression, optional(choice(kw("asc"), kw("desc")))),

    select_options: ($) => seq(kw("with"), commaSep1($.control_option)),

    control_option: ($) => seq(
      field("name", $.identifier),
      optional(seq("=", field("value", $._expression))),
    ),

    reportwriter_section: ($) => choice(
      $.head_report_section,
      $.head_page_section,
      $.head_group_section,
      $.detail_section,
      $.foot_group_section,
      $.foot_page_section,
      $.foot_report_section,
    ),

    head_report_section: ($) => prec.right(seq(kw("head"), kw("report"), repeat1($._reportwriter_item))),
    head_page_section: ($) => prec.right(seq(kw("head"), kw("page"), repeat1($._reportwriter_item))),
    head_group_section: ($) => prec.right(seq(kw("head"), field("group", $._expression), repeat1($._reportwriter_item))),
    detail_section: ($) => prec.right(seq(kw("detail"), repeat1($._reportwriter_item))),
    foot_group_section: ($) => prec.right(seq(kw("foot"), field("group", $._expression), repeat1($._reportwriter_item))),
    foot_page_section: ($) => prec.right(seq(kw("foot"), kw("page"), repeat1($._reportwriter_item))),
    foot_report_section: ($) => prec.right(seq(kw("foot"), kw("report"), repeat1($._reportwriter_item))),

    _reportwriter_item: ($) => choice(
      $.directive,
      $.row_statement,
      $.col_statement,
      $.break_statement,
      $.call_statement,
      $.reportwriter_assignment,
      $.if_statement,
      $.case_statement,
      $.for_statement,
      $.while_statement,
    ),

    row_statement: ($) => seq(kw("row"), optional(choice("+", "-")), $._expression),
    col_statement: ($) => prec.right(seq(kw("col"), optional(choice("+", "-")), $._expression, optional($._expression))),
    break_statement: ($) => prec.right(seq(kw("break"), optional($._expression))),
    reportwriter_assignment: ($) => prec(2, seq($.assignable_expression, choice("=", "+=", "-=", "*=", "/="), $._expression)),

    // Common data manipulation forms documented for modern CCL.
    insert_statement: ($) => prec.right(seq(
      kw("insert"),
      optional($.dml_table_clause),
      choice(
        $.insert_set_clause,
        $.insert_values_clause,
        $.insert_subquery_clause,
      ),
      optional($.plan_clause),
      optional($.select_options),
    )),

    dml_table_clause: ($) => seq(
      choice(kw("from"), kw("into")),
      commaSep1($.dml_table_reference),
    ),

    dml_table_reference: ($) => prec.right(seq(
      field("table", $.qualified_identifier),
      optional(field("alias", $.identifier)),
    )),

    insert_set_clause: ($) => seq(kw("set"), commaSep1($.update_assignment)),

    insert_values_clause: ($) => seq(
      "(", commaSep1(field("column", $.identifier)), ")",
      kw("values"),
      "(", commaSep1(field("value", $._expression)), ")",
    ),

    insert_subquery_clause: ($) => seq(
      "(", commaSep1(field("column", $.identifier)), ")",
      "(", field("query", $.select_statement), ")",
    ),

    update_statement: ($) => prec.right(seq(
      kw("update"),
      optional($.dml_table_clause),
      kw("set"),
      commaSep1($.update_assignment),
      optional(choice($.plan_clause, $.where_clause)),
      optional($.select_options),
    )),

    update_assignment: ($) => seq(field("column", $.assignable_expression), "=", field("value", $._expression)),

    delete_statement: ($) => prec.right(seq(
      kw("delete"),
      optional(seq(kw("from"), commaSep1($.dml_table_reference))),
      optional(seq(kw("set"), $.update_assignment)),
      optional(choice($.plan_clause, $.where_clause)),
      optional($.select_options),
    )),

    merge_statement: ($) => seq(
      kw("merge"),
      kw("into"),
      "(",
      field("target", $.dml_table_reference),
      ")",
      kw("using"),
      field("source", $.merge_source),
      kw("on"),
      parenthesized($._expression),
      $.merge_matched_clause,
      $.merge_not_matched_clause,
      optional($.select_options),
    ),

    merge_source: ($) => choice(
      $.dml_table_reference,
      seq("(", $.select_statement, ")", optional(field("alias", $.identifier))),
    ),

    merge_matched_clause: ($) => seq(
      kw("when"), kw("matched"), optional(kw("then")),
      repeat1(seq("(", $.update_statement, ")")),
    ),

    merge_not_matched_clause: ($) => seq(
      kw("when"), kw("not"), kw("matched"), optional(kw("then")),
      repeat1(seq("(", $.insert_statement, ")")),
    ),

    // Expressions. Keywords are case-insensitive but identifiers preserve case.
    _expression: ($) => choice(
      $.literal,
      $.prompt_parameter,
      $.pseudo_column,
      $.identifier,
      $.namespace_expression,
      $.parenthesized_expression,
      $.call_expression,
      $.member_expression,
      $.subscript_expression,
      $.unary_expression,
      $.not_expression,
      $.binary_expression,
      $.comparison_expression,
      $.between_expression,
      $.in_expression,
      $.exists_expression,
    ),

    assignable_expression: ($) => choice(
      $.identifier,
      $.namespace_expression,
      $.member_expression,
      $.subscript_expression,
    ),

    parenthesized_expression: ($) => parenthesized($._expression),

    namespace_expression: ($) => prec.left(PREC.POSTFIX, seq(
      field("namespace", $.identifier),
      "::",
      field("name", $.identifier),
    )),

    member_expression: ($) => prec.left(PREC.POSTFIX, seq(
      field("object", choice($.identifier, $.namespace_expression, $.member_expression, $.subscript_expression)),
      field("operator", choice(".", "->")),
      field("member", $.identifier),
    )),

    subscript_expression: ($) => prec.left(PREC.POSTFIX, seq(
      field("value", choice($.identifier, $.namespace_expression, $.member_expression, $.subscript_expression)),
      "[",
      commaSep1($._expression),
      "]",
    )),

    call_expression: ($) => prec(PREC.CALL, seq(
      field("function", choice(
        alias(token(/[sS][eE][qQ]/), $.identifier),
        $.identifier,
        $.namespace_expression,
        $.member_expression,
      )),
      "(",
      commaSep($._expression),
      ")",
    )),

    unary_expression: ($) => prec.right(PREC.UNARY, seq(
      field("operator", choice("+", "-")),
      field("operand", $._expression),
    )),

    not_expression: ($) => prec.right(PREC.NOT, seq(
      kw("not"),
      field("operand", $._expression),
    )),

    binary_expression: ($) => choice(
      prec.right(PREC.POWER, seq($._expression, field("operator", "**"), $._expression)),
      prec.left(PREC.MULTIPLY, seq($._expression, field("operator", choice("*", "/")), $._expression)),
      prec.left(PREC.ADD, seq($._expression, field("operator", choice("+", "-")), $._expression)),
      prec.left(PREC.CONCAT, seq($._expression, field("operator", "||"), $._expression)),
      prec.left(PREC.AND, seq($._expression, field("operator", kw("and")), $._expression)),
      prec.left(PREC.OR, seq($._expression, field("operator", kw("or")), $._expression)),
    ),

    comparison_expression: ($) => prec.left(PREC.COMPARE, seq(
      $._expression,
      field("operator", choice(
        "=", "!=", "<>", "<", "<=", ">", ">=",
        kw("like"),
        seq(kw("not"), kw("like")),
        seq(kw("is"), optional(kw("not"))),
      )),
      $._expression,
    )),

    between_expression: ($) => prec.left(PREC.COMPARE, seq(
      $._expression,
      optional(kw("not")),
      kw("between"),
      $._expression,
      kw("and"),
      $._expression,
    )),

    in_expression: ($) => prec.left(PREC.COMPARE, seq(
      $._expression,
      optional(kw("not")),
      kw("in"),
      "(",
      choice($.select_statement, commaSep1($._expression)),
      ")",
    )),

    exists_expression: ($) => prec(PREC.COMPARE, seq(
      kw("exists"),
      "(",
      $.select_statement,
      ")",
    )),

    literal: ($) => choice(
      $.string_literal,
      $.real_literal,
      $.wide_integer_literal,
      $.integer_literal,
      $.boolean_literal,
      $.null_literal,
    ),

    integer_literal: ($) => token(/[0-9]+/),
    wide_integer_literal: ($) => token(/[0-9]+\.[wW]/),
    real_literal: ($) => token(choice(/[0-9]+\.[0-9]+(?:[eE][+-]?[0-9]+)?/, /[0-9]+[eE][+-]?[0-9]+/)),
    boolean_literal: ($) => choice(kw("true"), kw("false")),
    null_literal: ($) => kw("null"),
    pseudo_column: ($) => kw("seq"),
    prompt_parameter: ($) => token(choice(
      /\$[A-Za-z_][A-Za-z0-9_]*/,
      /\$[1-9][0-9]?/,
    )),

    qualified_identifier: ($) => seq($.identifier, repeat(seq("::", $.identifier))),
    identifier: ($) => /[A-Za-z_][A-Za-z0-9_$]*/,

    block_comment: ($) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
  },
});

function kw(word) {
  return alias(new RegExp(word.split("").map((c) => `[${c.toLowerCase()}${c.toUpperCase()}]`).join("")), word);
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function parenthesized(rule) {
  return seq("(", rule, ")");
}

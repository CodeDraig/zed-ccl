#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

enum TokenType {
  SEMICOLON_COMMENT,
  BANG_COMMENT,
  DIRECTIVE_MARKER,
  REQUIRED_DIRECTIVE_NAME,
  OPTIONAL_DIRECTIVE_NAME,
  NO_ARGUMENT_DIRECTIVE_NAME,
  DIRECTIVE_ARGUMENTS,
  LINE_CONTINUATION,
  STRING_LITERAL,
};

typedef struct {
  uint8_t directive_state;
} Scanner;

enum DirectiveState {
  DIRECTIVE_NONE,
  DIRECTIVE_AFTER_MARKER,
  DIRECTIVE_AFTER_NAME,
};

void *tree_sitter_ccl_external_scanner_create(void) {
  return calloc(1, sizeof(Scanner));
}
void tree_sitter_ccl_external_scanner_destroy(void *payload) { free(payload); }
void tree_sitter_ccl_external_scanner_reset(void *payload) {
  ((Scanner *)payload)->directive_state = DIRECTIVE_NONE;
}
unsigned tree_sitter_ccl_external_scanner_serialize(void *payload, char *buffer) {
  buffer[0] = (char)((Scanner *)payload)->directive_state;
  return 1;
}
void tree_sitter_ccl_external_scanner_deserialize(void *payload, const char *buffer,
                                                   unsigned length) {
  ((Scanner *)payload)->directive_state =
      length == 1 ? (uint8_t)buffer[0] : DIRECTIVE_NONE;
}

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }
static void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

static bool scan_to_line_end(TSLexer *lexer) {
  while (lexer->lookahead != 0 && lexer->lookahead != '\n' &&
         lexer->lookahead != '\r') {
    advance(lexer);
  }
  lexer->mark_end(lexer);
  return true;
}

static bool scan_directive_arguments(TSLexer *lexer) {
  while (lexer->lookahead != 0 && lexer->lookahead != '\n' &&
         lexer->lookahead != '\r' && lexer->lookahead != ';') {
    advance(lexer);
  }
  lexer->mark_end(lexer);
  return true;
}

static bool is_directive_name_char(int32_t c) {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == '#';
}

static char ascii_upper(int32_t c) {
  if (c >= 'a' && c <= 'z') return (char)(c - ('a' - 'A'));
  return (char)c;
}

static int scan_directive_name(TSLexer *lexer) {
  char name[16];
  unsigned length = 0;

  while (is_directive_name_char(lexer->lookahead)) {
    if (length + 1 >= sizeof(name)) return -1;
    name[length++] = ascii_upper(lexer->lookahead);
    advance(lexer);
  }
  name[length] = '\0';

  static const struct {
    const char *name;
    enum TokenType type;
  } names[] = {
    {"INCLUDE", REQUIRED_DIRECTIVE_NAME}, {"I", REQUIRED_DIRECTIVE_NAME},
    {"MODULE", REQUIRED_DIRECTIVE_NAME}, {"M", REQUIRED_DIRECTIVE_NAME},
    {"PRINT", REQUIRED_DIRECTIVE_NAME}, {"P", REQUIRED_DIRECTIVE_NAME},
    {"RUN", REQUIRED_DIRECTIVE_NAME}, {"R", REQUIRED_DIRECTIVE_NAME},
    {"#DEFINE", REQUIRED_DIRECTIVE_NAME}, {"#DEF", REQUIRED_DIRECTIVE_NAME},
    {"#IFDEF", REQUIRED_DIRECTIVE_NAME}, {"#IFNDEF", REQUIRED_DIRECTIVE_NAME},
    {"#UNDEF", REQUIRED_DIRECTIVE_NAME},
    {"DISPLAY", OPTIONAL_DIRECTIVE_NAME}, {"D", OPTIONAL_DIRECTIVE_NAME},
    {"EDIT", OPTIONAL_DIRECTIVE_NAME}, {"E", OPTIONAL_DIRECTIVE_NAME},
    {"LEDIT", OPTIONAL_DIRECTIVE_NAME}, {"L", OPTIONAL_DIRECTIVE_NAME},
    {"OUTPUT", OPTIONAL_DIRECTIVE_NAME}, {"O", OPTIONAL_DIRECTIVE_NAME},
    {"TERMINAL", OPTIONAL_DIRECTIVE_NAME}, {"T", OPTIONAL_DIRECTIVE_NAME},
    {"BANNER", NO_ARGUMENT_DIRECTIVE_NAME}, {"B", NO_ARGUMENT_DIRECTIVE_NAME},
    {"CLEAR", NO_ARGUMENT_DIRECTIVE_NAME}, {"C", NO_ARGUMENT_DIRECTIVE_NAME},
    {"HELP", NO_ARGUMENT_DIRECTIVE_NAME}, {"H", NO_ARGUMENT_DIRECTIVE_NAME},
    {"JOURNAL", NO_ARGUMENT_DIRECTIVE_NAME}, {"J", NO_ARGUMENT_DIRECTIVE_NAME},
    {"KEDIT", NO_ARGUMENT_DIRECTIVE_NAME}, {"K", NO_ARGUMENT_DIRECTIVE_NAME},
    {"SHOW", NO_ARGUMENT_DIRECTIVE_NAME}, {"S", NO_ARGUMENT_DIRECTIVE_NAME},
    {"VERSION", NO_ARGUMENT_DIRECTIVE_NAME}, {"V", NO_ARGUMENT_DIRECTIVE_NAME},
    {"Z", NO_ARGUMENT_DIRECTIVE_NAME}, {"#ELSE", NO_ARGUMENT_DIRECTIVE_NAME},
    {"#ENDIF", NO_ARGUMENT_DIRECTIVE_NAME},
  };

  for (unsigned i = 0; i < sizeof(names) / sizeof(names[0]); i++) {
    const char *candidate = names[i].name;
    unsigned j = 0;
    while (candidate[j] != '\0' && j < length && candidate[j] == name[j]) j++;
    if (j == length && candidate[j] == '\0') {
      lexer->mark_end(lexer);
      return names[i].type;
    }
  }
  return -1;
}

static bool scan_semicolon_comment(TSLexer *lexer, bool can_continue) {
  bool ended_with_backslash = false;
  for (;;) {
    while (lexer->lookahead != 0 && lexer->lookahead != '\n' &&
           lexer->lookahead != '\r') {
      ended_with_backslash = lexer->lookahead == '\\';
      advance(lexer);
    }

    if (!can_continue || !ended_with_backslash || lexer->lookahead == 0) {
      lexer->mark_end(lexer);
      return true;
    }

    if (lexer->lookahead == '\r') advance(lexer);
    if (lexer->lookahead == '\n') advance(lexer);
    ended_with_backslash = false;
  }
}

static bool scan_string(TSLexer *lexer) {
  int32_t delimiter = lexer->lookahead;

  if (delimiter == '@') {
    advance(lexer);
    bool has_length = false;
    while (lexer->lookahead >= '0' && lexer->lookahead <= '9') {
      has_length = true;
      advance(lexer);
    }
    if (!has_length || lexer->lookahead != ':') return false;
    advance(lexer);
    while (lexer->lookahead != 0 && lexer->lookahead != '\n' &&
           lexer->lookahead != '\r' && lexer->lookahead != '@') {
      advance(lexer);
    }
    if (lexer->lookahead != '@') return false;
    advance(lexer);
    lexer->mark_end(lexer);
    return true;
  }

  if (delimiter != '\'' && delimiter != '"' && delimiter != '^' &&
      delimiter != '~' && delimiter != '|') {
    return false;
  }

  advance(lexer);
  while (lexer->lookahead != 0 && lexer->lookahead != '\n' &&
         lexer->lookahead != '\r') {
    if (lexer->lookahead == delimiter) {
      advance(lexer);
      lexer->mark_end(lexer);
      return true;
    }
    advance(lexer);
  }
  return false;
}

bool tree_sitter_ccl_external_scanner_scan(void *payload, TSLexer *lexer,
                                           const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;

  if (valid_symbols[DIRECTIVE_ARGUMENTS] &&
      scanner->directive_state == DIRECTIVE_AFTER_NAME) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') skip(lexer);
    if (lexer->lookahead != 0 && lexer->lookahead != '\n' &&
      lexer->lookahead != '\r' && lexer->lookahead != ';') {
      lexer->result_symbol = DIRECTIVE_ARGUMENTS;
      scanner->directive_state = DIRECTIVE_NONE;
      return scan_directive_arguments(lexer);
    }
    scanner->directive_state = DIRECTIVE_NONE;
  }

  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
         lexer->lookahead == '\n' || lexer->lookahead == '\r') {
    skip(lexer);
  }

  if (valid_symbols[DIRECTIVE_MARKER] && lexer->get_column(lexer) == 0 &&
      lexer->lookahead == '%') {
    advance(lexer);
    lexer->mark_end(lexer);
    scanner->directive_state = DIRECTIVE_AFTER_MARKER;
    lexer->result_symbol = DIRECTIVE_MARKER;
    return true;
  }

  if ((valid_symbols[REQUIRED_DIRECTIVE_NAME] ||
       valid_symbols[OPTIONAL_DIRECTIVE_NAME] ||
       valid_symbols[NO_ARGUMENT_DIRECTIVE_NAME]) &&
      scanner->directive_state == DIRECTIVE_AFTER_MARKER &&
      lexer->get_column(lexer) == 1 && is_directive_name_char(lexer->lookahead)) {
    int type = scan_directive_name(lexer);
    bool found = type >= 0 && valid_symbols[type];
    if (found) {
      lexer->result_symbol = (enum TokenType)type;
      scanner->directive_state = type == NO_ARGUMENT_DIRECTIVE_NAME
        ? DIRECTIVE_NONE
        : DIRECTIVE_AFTER_NAME;
    } else {
      scanner->directive_state = DIRECTIVE_NONE;
    }
    return found;
  }

  if (valid_symbols[BANG_COMMENT] && lexer->get_column(lexer) == 0 &&
      lexer->lookahead == '!') {
    advance(lexer);
    if (lexer->lookahead == '=') return false;
    lexer->result_symbol = BANG_COMMENT;
    return scan_to_line_end(lexer);
  }

  if (valid_symbols[SEMICOLON_COMMENT] && lexer->lookahead == ';') {
    bool can_continue = lexer->get_column(lexer) > 0;
    lexer->result_symbol = SEMICOLON_COMMENT;
    advance(lexer);
    return scan_semicolon_comment(lexer, can_continue);
  }

  if (valid_symbols[LINE_CONTINUATION] && lexer->lookahead == '\\') {
    lexer->result_symbol = LINE_CONTINUATION;
    advance(lexer);
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') advance(lexer);
    if (lexer->lookahead == '\r') advance(lexer);
    if (lexer->lookahead != '\n') return false;
    advance(lexer);
    lexer->mark_end(lexer);
    return true;
  }

  if (valid_symbols[STRING_LITERAL] &&
      (lexer->lookahead == '\'' || lexer->lookahead == '"' ||
       lexer->lookahead == '^' || lexer->lookahead == '~' ||
       lexer->lookahead == '|' || lexer->lookahead == '@')) {
    lexer->result_symbol = STRING_LITERAL;
    return scan_string(lexer);
  }

  return false;
}

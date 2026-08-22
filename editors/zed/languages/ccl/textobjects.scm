(program_definition) @class.around
(record_definition) @class.around
(subroutine_definition) @function.around

[
  (semicolon_comment)
  (bang_comment)
  (block_comment)
]+ @comment.around

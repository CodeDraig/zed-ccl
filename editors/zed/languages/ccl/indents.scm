(program_definition) @indent
(program_definition "end" @outdent)

(subroutine_definition) @indent
(subroutine_definition "end" @outdent)

(record_definition ")" @end) @indent

(if_statement) @indent
(if_statement "endif" @outdent)

(case_statement) @indent
(case_statement "endcase" @outdent)

(for_statement) @indent
(for_statement "endfor" @outdent)

(while_statement) @indent
(while_statement "endwhile" @outdent)

[
  (head_report_section)
  (head_page_section)
  (head_group_section)
  (detail_section)
  (foot_group_section)
  (foot_page_section)
  (foot_report_section)
] @indent

(set_operation
  left: (select_query) @left
  operator: (set_operator) @operator
  right: [
    (select_query)
    (set_operation)
  ] @right) @operation

// The three measurements `run_investigation` performs, in the order it performs
// them. Shared by the cold-open cover and the INVESTIGATING panel so the console
// promises exactly what it later reports, in the same words.
//
// These are the three the composite tool actually runs — simulate, verify the
// undo, evaluate policy — and the three the precondition lines report on when it
// returns. Nothing here is a number: neither screen has one yet.
export const PROOFS = [
  {
    label: 'Blast radius',
    body: 'The statement is run inside a shadow transaction that is rolled back, and every table the foreign keys reach is counted: rows that die, references that clear.',
  },
  {
    label: 'Undo proven',
    body: 'The generated rollback is replayed against committed shadow state. The key set has to come back identical, or the undo is not proven.',
  },
  {
    label: 'Policy passed',
    body: 'Four rules, by name: max_rows_deleted, protected_tables, require_verified_undo, restrict_edges_block. Any one of them blocking refuses the gate.',
  },
]

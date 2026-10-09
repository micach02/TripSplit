/**
 * Client-side mirrors of the RLS rules, used only to decide what to show.
 * The database enforces the real rules.
 */

interface ExpenseOwnership {
  created_by: string | null
  paid_by: string
}

/** The creator, the payer and the trip owner can edit or delete an expense. */
export function canEditExpense(expense: ExpenseOwnership, currentUserId: string, isTripOwner: boolean): boolean {
  return isTripOwner || expense.created_by === currentUserId || expense.paid_by === currentUserId
}

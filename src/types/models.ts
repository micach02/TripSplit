import type { Database } from '@/types/database'

/** TripSplit's database schema (everything lives in the `tripsplit` schema). */
export type TripSplitSchema = Database['tripsplit']
type Row<T extends keyof TripSplitSchema['Tables']> = TripSplitSchema['Tables'][T]['Row']
type Update<T extends keyof TripSplitSchema['Tables']> = TripSplitSchema['Tables'][T]['Update']
type Enum<T extends keyof TripSplitSchema['Enums']> = TripSplitSchema['Enums'][T]

/** App-facing aliases for database rows. */
export type Profile = Row<'profiles'>
export type ProfileUpdate = Pick<Update<'profiles'>, 'full_name' | 'avatar_url' | 'preferred_currency' | 'default_trip_id'>

export type Trip = Row<'trips'>
export type TripMember = Row<'trip_members'>
export type TripInvitation = Row<'trip_invitations'>
export type Category = Row<'categories'>
export type Expense = Row<'expenses'>
export type ExpenseSplit = Row<'expense_splits'>
export type Settlement = Row<'settlements'>
export type BudgetCategory = Row<'budget_categories'>
export type RecurringExpense = Row<'recurring_expenses'>
export type Income = Row<'incomes'>

export type TripStatus = Enum<'trip_status'>
export type MemberRole = Enum<'member_role'>
export type InvitationStatus = Enum<'invitation_status'>
export type SplitType = Enum<'split_type'>
export type PaymentMethod = Enum<'payment_method'>
export type RecurringMode = Enum<'recurring_mode'>

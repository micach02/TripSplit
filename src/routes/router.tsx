import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { FocusLayout } from '@/components/layout/FocusLayout'
import { RootLayout } from '@/components/layout/RootLayout'
// Eager on purpose: it must render even when a lazy chunk fails to load.
import RouteErrorPage from '@/pages/RouteErrorPage'
import {
  ActivityPage,
  AddExpensePage,
  CreateTripPage,
  DashboardPage,
  ExpenseFormPage,
  ForgotPasswordPage,
  InvitePage,
  LoginPage,
  NotFoundPage,
  NotificationsPage,
  ProfilePage,
  RegisterPage,
  ResetPasswordPage,
  SettingsPage,
  TripAnalyticsPage,
  TripBalancesPage,
  TripExpensesPage,
  TripLayout,
  TripOverviewPage,
  TripPeoplePage,
  TripSettingsPage,
  TripSettlementsPage,
  TripsPage,
} from '@/routes/lazyPages'
import { paths, routerBasename } from '@/routes/paths'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to={paths.dashboard} replace /> },
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: paths.login, element: <LoginPage /> },
              { path: paths.register, element: <RegisterPage /> },
              { path: paths.forgotPassword, element: <ForgotPasswordPage /> },
            ],
          },
        ],
      },
      {
        // Reachable both signed out (expired link) and signed in (recovery session).
        element: <AuthLayout />,
        children: [{ path: paths.resetPassword, element: <ResetPasswordPage /> }],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: paths.dashboard, element: <DashboardPage /> },
              { path: paths.trips, element: <TripsPage /> },
              { path: paths.newTrip, element: <CreateTripPage /> },
              {
                path: '/trips/:tripId',
                element: <TripLayout />,
                children: [
                  { index: true, element: <TripOverviewPage /> },
                  { path: 'expenses', element: <TripExpensesPage /> },
                  { path: 'people', element: <TripPeoplePage /> },
                  { path: 'balances', element: <TripBalancesPage /> },
                  { path: 'settlements', element: <TripSettlementsPage /> },
                  { path: 'analytics', element: <TripAnalyticsPage /> },
                  { path: 'settings', element: <TripSettingsPage /> },
                ],
              },
              { path: paths.addExpense, element: <AddExpensePage /> },
              // Shared invite links; signed-out visitors log in or register first, then come back here.
              { path: '/invite/:token', element: <InvitePage /> },
              { path: paths.activity, element: <ActivityPage /> },
              { path: paths.notifications, element: <NotificationsPage /> },
              { path: paths.profile, element: <ProfilePage /> },
              { path: paths.settings, element: <SettingsPage /> },
            ],
          },
          {
            // Full-screen expense entry: no navigation chrome on phones.
            element: <FocusLayout />,
            children: [
              { path: '/trips/:tripId/expenses/new', element: <ExpenseFormPage /> },
              { path: '/trips/:tripId/expenses/:expenseId/edit', element: <ExpenseFormPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
], { basename: routerBasename })

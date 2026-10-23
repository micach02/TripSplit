import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { FocusLayout } from '@/components/layout/FocusLayout'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { RootLayout } from '@/components/layout/RootLayout'
// Eager on purpose: it must render even when a lazy chunk fails to load.
import RouteErrorPage from '@/pages/RouteErrorPage'
import {
  AddExpensePage,
  CreateTripPage,
  DashboardPage,
  ExpenseFormPage,
  ForgotPasswordPage,
  InvitePage,
  LoginPage,
  MySpendingPage,
  NotFoundPage,
  NotificationsPage,
  PrivacyPage,
  ProfilePage,
  RegisterPage,
  ResetPasswordPage,
  SearchPage,
  SettingsPage,
  TripAnalyticsPage,
  TripBalancesPage,
  TripExpensesPage,
  TripLayout,
  TripOverviewPage,
  TripPeoplePage,
  TermsPage,
  TripSettingsPage,
  TripsPage,
  WelcomePage,
} from '@/routes/lazyPages'
import { HomeRoute } from '@/routes/HomeRoute'
import { paths, routerBasename } from '@/routes/paths'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        // The landing page, legal pages: open to everyone
        element: <PublicLayout />,
        children: [
          { index: true, element: <HomeRoute /> },
          { path: paths.privacy, element: <PrivacyPage /> },
          { path: paths.terms, element: <TermsPage /> },
        ],
      },
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
                  // Payments now live on Balances; old links still land there.
                  { path: 'settlements', element: <Navigate to="../balances#payments" relative="path" replace /> },
                  { path: 'analytics', element: <TripAnalyticsPage /> },
                  { path: 'settings', element: <TripSettingsPage /> },
                ],
              },
              { path: paths.addExpense, element: <AddExpensePage /> },
              // Shared invite links; signed-out visitors log in or register first, then come back here.
              { path: '/invite/:token', element: <InvitePage /> },
              { path: paths.spending, element: <MySpendingPage /> },
              { path: paths.search, element: <SearchPage /> },
              // The old Activity placeholder
              { path: paths.activity, element: <Navigate to={paths.spending} replace /> },
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
              { path: paths.welcome, element: <WelcomePage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
], { basename: routerBasename })

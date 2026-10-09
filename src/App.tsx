import { Suspense } from 'react'
import { RouterProvider } from 'react-router'
import { AuthProvider } from '@/contexts/AuthProvider'
import { ToastProvider } from '@/contexts/ToastProvider'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { router } from '@/routes/router'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<FullPageLoader />}>
          <RouterProvider router={router} />
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  )
}

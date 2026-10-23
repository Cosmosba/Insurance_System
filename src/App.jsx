import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Login from './pages/Login'
import MainLayout from './layouts/MainLayout'
import CustomerLayout from './layouts/CustomerLayout'
import Dashboard from './pages/Dashboard'
import CustomerDashboard from './pages/CustomerDashboard'
import MyPolicies from './pages/MyPolicies'
import PolicyDetail from './pages/PolicyDetail'
import Payments from './pages/Payments'
import PaymentDetail from './pages/PaymentDetail'
import MyClaims from './pages/MyClaims'
import ClaimDetail from './pages/ClaimDetail'
import NewClaim from './pages/NewClaim'
import MyProfile from './pages/MyProfile'
import SuperadminLayout from './layouts/SuperadminLayout'
import SuperadminDashboard from './pages/admin/SuperadminDashboard'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Staff — protected */}
        <Route
          path="/staff/dashboard"
          element={
            <ProtectedRoute requiredRole="staff">
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Customer — protected */}
        <Route
          path="/customer/dashboard"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerLayout>
                <CustomerDashboard />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/policies"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerLayout>
                <MyPolicies />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/policies/:id"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerLayout>
                <PolicyDetail />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/payments"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerLayout>
                <Payments />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/payments/:ref"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerLayout>
                <PaymentDetail />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/claims"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerLayout>
                <MyClaims />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/claims/new"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerLayout>
                <NewClaim />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/claims/:ref"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerLayout>
                <ClaimDetail />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/profile"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerLayout>
                <MyProfile />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        {/* Superadmin — protected */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredRole="superadmin">
              <SuperadminLayout>
                <SuperadminDashboard />
              </SuperadminLayout>
            </ProtectedRoute>
          }
        />

        {/* Fallback — send everyone to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

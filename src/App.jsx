import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Login from './features/auth/pages/Login'
import ChangePassword from './features/auth/pages/ChangePassword'
import MainLayout from './layouts/MainLayout'
import CustomerLayout from './layouts/CustomerLayout'
import Dashboard from './features/staff/pages/Dashboard'
import CustomerDashboard from './features/customer/pages/CustomerDashboard'
import MyPolicies from './features/customer/pages/MyPolicies'
import PolicyDetail from './features/customer/pages/PolicyDetail'
import Payments from './features/customer/pages/Payments'
import PaymentDetail from './features/customer/pages/PaymentDetail'
import MyClaims from './features/customer/pages/MyClaims'
import ClaimDetail from './features/customer/pages/ClaimDetail'
import NewClaim from './features/customer/pages/NewClaim'
import MyProfile from './features/customer/pages/MyProfile'
import CustomerSettings from './features/customer/pages/CustomerSettings'
import SuperadminLayout from './layouts/SuperadminLayout'
import SuperadminDashboard from './features/superadmin/pages/SuperadminDashboard'
import DepartmentsManagement from './features/superadmin/pages/DepartmentsManagement'
import UserManagement from './features/superadmin/pages/UserManagement'
import RolesPermissions from './features/superadmin/pages/RolesPermissions'
import CustomerManagement from './features/superadmin/pages/CustomerManagement'
import SystemActivity from './features/superadmin/pages/SystemActivity'
import ReportsAnalytics from './features/superadmin/pages/ReportsAnalytics'
import Settings from './features/superadmin/pages/Settings'
import ProtectedRoute from './components/ProtectedRoute'
import ThemeProvider from './components/ThemeProvider'
import { getSession } from './services/mockAuth'
import './styles/glass-system.css'

function CustomerManagementLayout({ children }) {
  return getSession()?.role === 'superadmin'
    ? <SuperadminLayout>{children}</SuperadminLayout>
    : <MainLayout>{children}</MainLayout>
}

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Staff — protected */}
        <Route
          path="/staff/dashboard"
          element={
            <ProtectedRoute requiredRole="staff" requiredPermission="dashboard.department.view">
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
            <ProtectedRoute requiredRole="customer" requiredPermission="dashboard.customer.view">
              <CustomerLayout>
                <CustomerDashboard />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/policies"
          element={
            <ProtectedRoute requiredRole="customer" requiredPermission="policies.view_own">
              <CustomerLayout>
                <MyPolicies />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/policies/:id"
          element={
            <ProtectedRoute requiredRole="customer" requiredPermission="policies.view_own">
              <CustomerLayout>
                <PolicyDetail />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/payments"
          element={
            <ProtectedRoute requiredRole="customer" requiredPermission="payments.view_own">
              <CustomerLayout>
                <Payments />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/payments/:ref"
          element={
            <ProtectedRoute requiredRole="customer" requiredPermission="payments.view_own">
              <CustomerLayout>
                <PaymentDetail />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/claims"
          element={
            <ProtectedRoute requiredRole="customer" requiredPermission="claims.view_own">
              <CustomerLayout>
                <MyClaims />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/claims/new"
          element={
            <ProtectedRoute requiredRole="customer" requiredPermission="claims.submit_own">
              <CustomerLayout>
                <NewClaim />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/claims/:ref"
          element={
            <ProtectedRoute requiredRole="customer" requiredPermission="claims.view_own">
              <CustomerLayout>
                <ClaimDetail />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/profile"
          element={
            <ProtectedRoute requiredRole="customer" requiredPermission="profile.view_own">
              <CustomerLayout>
                <MyProfile />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer/settings"
          element={
            <ProtectedRoute requiredRole="customer" requiredPermission="settings.view_own">
              <CustomerLayout>
                <CustomerSettings />
              </CustomerLayout>
            </ProtectedRoute>
          }
        />

        {/* Superadmin — protected */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredRole="superadmin" requiredPermission="dashboard.admin.view">
              <SuperadminLayout>
                <SuperadminDashboard />
              </SuperadminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/departments"
          element={
            <ProtectedRoute requiredRole="superadmin" requiredPermission="departments.view">
              <SuperadminLayout>
                <DepartmentsManagement />
              </SuperadminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/departments/:id"
          element={
            <ProtectedRoute requiredRole="superadmin" requiredPermission="departments.view">
              <SuperadminLayout>
                <DepartmentsManagement />
              </SuperadminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="superadmin" requiredPermission="users.view">
              <SuperadminLayout>
                <UserManagement />
              </SuperadminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users/:id"
          element={
            <ProtectedRoute requiredRole="superadmin" requiredPermission="users.view">
              <SuperadminLayout>
                <UserManagement />
              </SuperadminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/roles-permissions"
          element={
            <ProtectedRoute requiredRole="superadmin" requiredPermission="roles.view">
              <SuperadminLayout>
                <RolesPermissions />
              </SuperadminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/system-activity"
          element={
            <ProtectedRoute requiredRole="superadmin" requiredPermission="activity.view">
              <SuperadminLayout>
                <SystemActivity />
              </SuperadminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute requiredRole="superadmin" requiredPermission="reports.view">
              <SuperadminLayout>
                <ReportsAnalytics />
              </SuperadminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute requiredRole="superadmin" requiredPermission="settings.manage">
              <SuperadminLayout>
                <Settings />
              </SuperadminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/customers"
          element={
            <ProtectedRoute requiredPermission="customers.view">
              <CustomerManagementLayout>
                <CustomerManagement />
              </CustomerManagementLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/customers/:id"
          element={
            <ProtectedRoute requiredPermission="customers.view">
              <CustomerManagementLayout>
                <CustomerManagement />
              </CustomerManagementLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/roles"
          element={<Navigate to="/admin/roles-permissions" replace />}
        />
        <Route
          path="/admin/activity"
          element={<Navigate to="/admin/system-activity" replace />}
        />

        {/* Fallback — send everyone to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  )
}

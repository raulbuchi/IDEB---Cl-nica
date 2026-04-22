import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';

// Lazy load pages
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Patients = React.lazy(() => import('./pages/Patients'));
const MedicalRecords = React.lazy(() => import('./pages/MedicalRecords'));
const Productivity = React.lazy(() => import('./pages/Productivity'));
const Financial = React.lazy(() => import('./pages/Financial'));
const Professionals = React.lazy(() => import('./pages/Professionals'));
const Admin = React.lazy(() => import('./pages/Admin'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();

  if (loading) return null;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          }>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/patients" element={<RequireAuth><Patients /></RequireAuth>} />
              <Route path="/records" element={<RequireAuth><MedicalRecords /></RequireAuth>} />
              <Route path="/productivity" element={<RequireAuth><Productivity /></RequireAuth>} />
              <Route path="/financial" element={<RequireAuth><Financial /></RequireAuth>} />
              <Route path="/professionals" element={
                <RequireAuth>
                  <RequireAdmin>
                    <Professionals />
                  </RequireAdmin>
                </RequireAuth>
              } />
              
              <Route path="/admin" element={
                <RequireAuth>
                  <RequireAdmin>
                    <Admin />
                  </RequireAdmin>
                </RequireAuth>
              } />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}


import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/store';
import ErrorBoundary from '@/components/ErrorBoundary';
import LazyLoadErrorBoundary from '@/components/LazyLoadErrorBoundary';
import { LoadingFallback, PageLoadingFallback } from '@/components/LoadingFallback';
import { createLazyPage, prefetchLazyComponent } from '@/utils/lazyLoading';

// Lazy load all pages with code splitting
const { Component: LazyLoginPage, fallback: loginFallback } = createLazyPage(
  () => import('@/pages/LoginPage'),
  { preload: true, onLoad: ({ loadTime }) => console.debug(`LoginPage: ${loadTime.toFixed(2)}ms`) }
);

const { Component: LazyDashboardPage, fallback: dashboardFallback } = createLazyPage(
  () => import('@/pages/DashboardPage'),
  { preload: true, onLoad: ({ loadTime }) => console.debug(`DashboardPage: ${loadTime.toFixed(2)}ms`) }
);

const { Component: LazyVouchersPage, fallback: vouchersFallback } = createLazyPage(
  () => import('@/pages/VouchersPage'),
  { preload: true, onLoad: ({ loadTime }) => console.debug(`VouchersPage: ${loadTime.toFixed(2)}ms`) }
);

const { Component: LazyOrdersPage, fallback: ordersFallback } = createLazyPage(
  () => import('@/pages/OrdersPage'),
  { preload: true, onLoad: ({ loadTime }) => console.debug(`OrdersPage: ${loadTime.toFixed(2)}ms`) }
);

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  
  // Prefetch dashboard on login page view
  useEffect(() => {
    if (isAuthenticated && LazyDashboardPage.preload) {
      prefetchLazyComponent(LazyDashboardPage.preload);
    }
  }, [isAuthenticated]);

  return isAuthenticated ? children : <Navigate to="/login" />;
}

function Navigation() {
  const { isAuthenticated, logout, user } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link to="/" className="text-2xl font-bold">
            🏛️ Vouchers Hotel
          </Link>
          <div className="hidden md:flex space-x-4">
            <Link to="/dashboard" className="hover:bg-blue-700 px-4 py-2 rounded-lg transition">
              📊 Dashboard
            </Link>
            <Link to="/vouchers" className="hover:bg-blue-700 px-4 py-2 rounded-lg transition">
              🎫 Vouchers
            </Link>
            <Link to="/orders" className="hover:bg-blue-700 px-4 py-2 rounded-lg transition">
              🍽️ Órdenes
            </Link>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm">{user?.email}</span>
          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg font-bold transition"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LazyLoadErrorBoundary>
        <Router>
          <Toaster position="top-center" />
          <Navigation />
          <Routes>
            {/* Login route - lazy loaded */}
            <Route
              path="/login"
              element={
                <Suspense fallback={loginFallback}>
                  <LazyLoginPage />
                </Suspense>
              }
            />

            {/* Dashboard route - lazy loaded with protection */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Suspense fallback={dashboardFallback}>
                    <LazyDashboardPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* Vouchers route - lazy loaded with protection */}
            <Route
              path="/vouchers"
              element={
                <ProtectedRoute>
                  <Suspense fallback={vouchersFallback}>
                    <LazyVouchersPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* Orders route - lazy loaded with protection */}
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Suspense fallback={ordersFallback}>
                    <LazyOrdersPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* Default route */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </LazyLoadErrorBoundary>
    </ErrorBoundary>
  );
}

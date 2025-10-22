import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/store';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import VouchersPage from '@/pages/VouchersPage';
import OrdersPage from '@/pages/OrdersPage';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
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
    <Router>
      <Toaster position="top-center" />
      <Navigation />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vouchers"
          element={
            <ProtectedRoute>
              <VouchersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

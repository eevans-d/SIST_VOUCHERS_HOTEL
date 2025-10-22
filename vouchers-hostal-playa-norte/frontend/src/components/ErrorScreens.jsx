import React from 'react';

/**
 * NotFoundBoundary (404) Component
 * 
 * Handles route not found and 404 errors.
 * Provides helpful navigation options.
 */
export function NotFoundBoundary() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl text-center">
        <div className="text-7xl mb-4 font-bold text-amber-600">404</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Página No Encontrada
        </h1>
        <p className="text-gray-600 mb-8">
          La página que buscas no existe o fue movida.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/dashboard"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            📊 Ir al Dashboard
          </a>
          <a
            href="/"
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            🏠 Inicio
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * ServerErrorBoundary (500) Component
 * 
 * Handles server errors and API failures.
 * Shows retry option and error details.
 */
export function ServerErrorBoundary({ onRetry, errorCode = 500 }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl text-center">
        <div className="text-7xl mb-4">⚠️</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Error del Servidor ({errorCode})
        </h1>
        <p className="text-gray-600 mb-8">
          El servidor temporalmente no está disponible.
          Por favor intenta de nuevo más tarde.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition"
            >
              🔄 Reintentar
            </button>
          )}
          <a
            href="/"
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            🏠 Volver
          </a>
        </div>

        {/* Status Indicator */}
        <div className="mt-8 p-4 bg-gray-50 rounded border border-gray-200">
          <p className="text-sm text-gray-600">
            Estatus actual del servicio: <span className="font-bold text-red-600">En mantenimiento</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * TimeoutBoundary Component
 * 
 * Handles request timeouts and slow network errors.
 * Provides options for retry or cancellation.
 */
export function TimeoutBoundary({ onRetry, onCancel }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl text-center">
        <div className="text-6xl mb-4">⏱️</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          La Solicitud Tomó Demasiado Tiempo
        </h1>
        <p className="text-gray-600 mb-8">
          La conexión es lenta o el servidor está bajo carga.
          Intenta de nuevo o aguarda unos momentos.
        </p>

        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-8 rounded text-left">
          <p className="text-sm text-orange-800">
            💡 <strong>Consejos:</strong>
          </p>
          <ul className="mt-2 text-sm text-orange-700 space-y-1">
            <li>✓ Verifica tu conexión a Internet</li>
            <li>✓ Intenta cerrar pestaña y abrir nuevamente</li>
            <li>✓ Espera unos momentos antes de reintentar</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onRetry}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            🔄 Reintentar
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            ❌ Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * UnauthorizedBoundary (401) Component
 * 
 * Handles authentication errors.
 * Redirects to login.
 */
export function UnauthorizedBoundary() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl text-center">
        <div className="text-6xl mb-4">🔐</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Autenticación Requerida
        </h1>
        <p className="text-gray-600 mb-8">
          Tu sesión ha expirado. Por favor inicia sesión nuevamente.
        </p>

        <a
          href="/login"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg transition"
        >
          🔑 Iniciar Sesión
        </a>
      </div>
    </div>
  );
}

/**
 * ForbiddenBoundary (403) Component
 * 
 * Handles permission denied errors.
 * Informs user about insufficient permissions.
 */
export function ForbiddenBoundary() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-purple-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Acceso Denegado
        </h1>
        <p className="text-gray-600 mb-8">
          No tienes permiso para acceder a este recurso.
          Si crees que esto es un error, contacta a administración.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/dashboard"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            📊 Volver al Dashboard
          </a>
          <a
            href="mailto:admin@example.com"
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            📧 Contactar Admin
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * ValidationErrorBoundary Component
 * 
 * Handles form validation and input errors.
 * Provides helpful error messages.
 */
export function ValidationErrorBoundary({ errors = [] }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-start">
        <div className="text-2xl mr-4">⚠️</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-red-800 mb-3">
            Por favor revisa los siguientes errores:
          </h3>
          <ul className="space-y-2">
            {errors.map((error, idx) => (
              <li
                key={idx}
                className="flex items-start text-red-700"
              >
                <span className="mr-2">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default {
  NotFoundBoundary,
  ServerErrorBoundary,
  TimeoutBoundary,
  UnauthorizedBoundary,
  ForbiddenBoundary,
  ValidationErrorBoundary,
};

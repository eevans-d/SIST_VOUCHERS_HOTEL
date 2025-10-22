import React from 'react';

/**
 * LoadingFallback Component
 * 
 * Renders a smooth loading UI while lazy-loaded components are being fetched.
 * Uses skeleton screens and animated placeholders for better UX.
 * 
 * @component
 * @example
 * <Suspense fallback={<LoadingFallback />}>
 *   <DashboardPage />
 * </Suspense>
 */
export function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 animate-pulse">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="h-10 bg-gray-200 rounded-lg mb-8 w-1/3"></div>

        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-200 rounded-xl h-40 shimmer"
            ></div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-200 rounded-xl h-64 shimmer"
            ></div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
        
        .shimmer {
          background: linear-gradient(
            90deg,
            #f0f0f0 25%,
            #e0e0e0 50%,
            #f0f0f0 75%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * PageLoadingFallback Component
 * 
 * Generic fallback for page-level loading states.
 * Used for all lazy-loaded routes.
 */
export function PageLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block relative w-20 h-20 mb-4">
          <div className="absolute border-4 border-blue-200 rounded-full w-full h-full"></div>
          <div
            className="absolute border-4 border-blue-600 rounded-full w-full h-full animate-spin"
            style={{ borderTopColor: 'transparent', borderRightColor: 'transparent' }}
          ></div>
        </div>
        <p className="text-gray-600 font-medium">Cargando...</p>
        <p className="text-gray-400 text-sm mt-2">Por favor espera</p>
      </div>

      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * ChunkLoadingError Component
 * 
 * Error boundary fallback for chunk loading failures.
 * Provides retry mechanism for failed lazy-loaded imports.
 */
export function ChunkLoadingError({ retry }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Error cargando página
        </h1>
        <p className="text-gray-600 mb-6">
          Hubo un problema al cargar el módulo. Por favor intenta de nuevo.
        </p>
        <button
          onClick={retry}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition"
        >
          🔄 Reintentar
        </button>
      </div>
    </div>
  );
}

export default LoadingFallback;

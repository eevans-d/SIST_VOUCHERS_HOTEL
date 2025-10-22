import React from 'react';

/**
 * ErrorBoundary Component (Generic)
 * 
 * Top-level error boundary for catching rendering errors throughout the app.
 * Prevents white screen of death by catching unhandled React errors.
 * 
 * Features:
 * - Catches render errors
 * - Logs to error tracking service
 * - User-friendly error UI
 * - Recovery options
 * 
 * @component
 * @example
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Generate error ID for tracking
    const errorId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.error('❌ Error caught by boundary:', error);
    console.error('Component stack:', errorInfo.componentStack);

    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Send to error tracking service
    if (window.__ERROR_TRACKING__) {
      window.__ERROR_TRACKING__.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          errorType: 'renderError',
          errorId,
        },
      });
    }

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.group('🔍 Error Boundary Debug Info');
      console.log('Error ID:', errorId);
      console.log('Error:', error);
      console.log('Stack:', errorInfo);
      console.groupEnd();
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-red-50 to-red-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl">
            {/* Error Header */}
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">😔</div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                ¡Algo salió mal!
              </h1>
              <p className="text-gray-600">
                Lo sentimos, ocurrió un error inesperado en la aplicación.
              </p>
            </div>

            {/* Error Details (Development only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
                <h3 className="font-bold text-red-800 mb-2">Error Details:</h3>
                <p className="text-red-700 font-mono text-sm break-words mb-3">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-sm text-red-600 cursor-pointer">
                    <summary className="font-semibold mb-2">
                      Component Stack
                    </summary>
                    <pre className="bg-white p-2 rounded overflow-x-auto text-xs">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Error ID for support */}
            <div className="bg-gray-50 p-4 rounded mb-6 text-center">
              <p className="text-sm text-gray-600 mb-1">
                Error ID: <span className="font-mono font-bold text-gray-800">
                  {this.state.errorId}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Comparte este ID con soporte técnico
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={this.handleReset}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition"
              >
                🔄 Intentar Nuevamente
              </button>
              <button
                onClick={this.handleReload}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition"
              >
                🔁 Recargar Página
              </button>
            </div>

            {/* Support Links */}
            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600 mb-3">
                ¿Necesitas ayuda?
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Volver al inicio
                </a>
                <a
                  href="mailto:support@example.com"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Contactar Soporte
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

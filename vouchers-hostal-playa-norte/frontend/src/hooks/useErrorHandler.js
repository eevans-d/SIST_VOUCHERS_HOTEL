import React from 'react';

/**
 * useErrorHandler Hook
 * 
 * Centralized error handling logic for components.
 * Handles different error types and provides recovery mechanisms.
 * 
 * @returns {Object} Error handling utilities
 */
export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);
  const [isRecovering, setIsRecovering] = React.useState(false);

  /**
   * Handle API errors
   */
  const handleApiError = React.useCallback((error) => {
    if (!error) return;

    const statusCode = error.response?.status;
    const message = error.response?.data?.message || error.message;

    const errorInfo = {
      type: 'api',
      statusCode,
      message,
      timestamp: new Date(),
      details: error.response?.data,
    };

    setError(errorInfo);

    // Log to tracking service
    if (window.__ERROR_TRACKING__) {
      window.__ERROR_TRACKING__.captureException(error, {
        tags: {
          errorType: 'apiError',
          statusCode,
        },
      });
    }

    return errorInfo;
  }, []);

  /**
   * Handle network errors
   */
  const handleNetworkError = React.useCallback((error) => {
    const errorInfo = {
      type: 'network',
      message: 'Error de conexión. Verifica tu Internet.',
      timestamp: new Date(),
      details: error,
    };

    setError(errorInfo);

    if (window.__ERROR_TRACKING__) {
      window.__ERROR_TRACKING__.captureException(error, {
        tags: { errorType: 'networkError' },
      });
    }

    return errorInfo;
  }, []);

  /**
   * Handle timeout errors
   */
  const handleTimeoutError = React.useCallback(() => {
    const errorInfo = {
      type: 'timeout',
      message: 'La solicitud tomó demasiado tiempo. Intenta de nuevo.',
      timestamp: new Date(),
    };

    setError(errorInfo);
    return errorInfo;
  }, []);

  /**
   * Handle validation errors
   */
  const handleValidationError = React.useCallback((errors = []) => {
    const errorInfo = {
      type: 'validation',
      message: 'Por favor revisa los errores de validación',
      timestamp: new Date(),
      details: errors,
    };

    setError(errorInfo);
    return errorInfo;
  }, []);

  /**
   * Get error message based on type
   */
  const getErrorMessage = React.useCallback((error) => {
    if (!error) return '';

    const messageMap = {
      400: 'Solicitud inválida',
      401: 'Autenticación requerida',
      403: 'Acceso denegado',
      404: 'Recurso no encontrado',
      408: 'Solicitud caducada',
      429: 'Demasiadas solicitudes. Intenta de nuevo más tarde',
      500: 'Error del servidor',
      502: 'Gateway inválido',
      503: 'Servicio no disponible',
      504: 'Gateway timeout',
    };

    if (error.message) return error.message;
    if (error.statusCode) return messageMap[error.statusCode] || 'Error desconocido';
    return 'Ocurrió un error inesperado';
  }, []);

  /**
   * Retry action with exponential backoff
   */
  const retry = React.useCallback(async (action, maxRetries = 3) => {
    setIsRecovering(true);
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await action();
        setError(null);
        return result;
      } catch (err) {
        lastError = err;
        
        // Exponential backoff: 100ms, 200ms, 400ms
        const backoffMs = Math.pow(2, attempt) * 100;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));

        console.debug(
          `Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${backoffMs}ms`
        );
      }
    }

    // All retries failed
    handleApiError(lastError);
    setIsRecovering(false);
    return null;
  }, [handleApiError]);

  /**
   * Clear current error
   */
  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset error state completely
   */
  const reset = React.useCallback(() => {
    setError(null);
    setIsRecovering(false);
  }, []);

  return {
    error,
    isRecovering,
    handleApiError,
    handleNetworkError,
    handleTimeoutError,
    handleValidationError,
    getErrorMessage,
    retry,
    clearError,
    reset,
  };
};

/**
 * useAsyncError Hook
 * 
 * Catch errors from async operations in functional components.
 * Useful for handling errors that occur outside of render.
 */
export const useAsyncError = () => {
  const [, setError] = React.useState();

  return React.useCallback((error) => {
    setError(() => {
      throw error;
    });
  }, [setError]);
};

/**
 * withErrorBoundary HOC
 * 
 * Higher-order component to wrap components with error boundary.
 * Simplifies error boundary application to functional components.
 * 
 * @param {React.Component} Component - Component to wrap
 * @param {Object} errorBoundaryProps - Props for error boundary
 * @returns {React.Component} Wrapped component
 * 
 * @example
 * export default withErrorBoundary(DashboardPage, {
 *   fallback: <ErrorScreen />
 * });
 */
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  return React.forwardRef((props, ref) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component ref={ref} {...props} />
    </ErrorBoundary>
  ));
};

/**
 * Error Boundary Class Component
 * (Used by withErrorBoundary)
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error Boundary caught:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="text-center p-6">
          <p className="text-red-600">Error: {this.state.error?.message}</p>
          <button
            onClick={this.reset}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default {
  useErrorHandler,
  useAsyncError,
  withErrorBoundary,
};

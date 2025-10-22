import React from 'react';
import { ChunkLoadingError } from './LoadingFallback';

/**
 * LazyLoadErrorBoundary Component
 * 
 * Error boundary specifically designed for lazy-loaded chunks.
 * Catches chunk loading errors and provides recovery mechanism.
 * 
 * Features:
 * - Catches chunk loading errors (network failures, missing chunks)
 * - Provides retry functionality
 * - Logs errors for debugging
 * - User-friendly error UI
 * 
 * @component
 * @example
 * <LazyLoadErrorBoundary>
 *   <Suspense fallback={<LoadingFallback />}>
 *     <DashboardPage />
 *   </Suspense>
 * </LazyLoadErrorBoundary>
 */
export class LazyLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error for debugging
    console.error('Chunk loading error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Send to error tracking service (e.g., Sentry)
    if (window.__ERROR_TRACKING__) {
      window.__ERROR_TRACKING__.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          errorType: 'chunkLoadingError',
        },
      });
    }
  }

  handleRetry = () => {
    const { retryCount } = this.state;
    
    if (retryCount >= 3) {
      console.error('Max retry attempts reached');
      return;
    }

    // Clear the error state
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));

    // Reload the page to retry chunk loading
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ChunkLoadingError retry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

export default LazyLoadErrorBoundary;

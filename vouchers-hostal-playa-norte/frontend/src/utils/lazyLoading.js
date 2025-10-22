import React from 'react';
import { PageLoadingFallback } from '../components/LoadingFallback';

/**
 * createLazyPage Utility Function
 * 
 * Factory function for creating lazy-loaded page components with consistent
 * loading and error handling.
 * 
 * Benefits:
 * - Automatic code splitting per page
 * - Consistent loading UI across all pages
 * - Preload hints for better performance
 * - Metrics collection for monitoring
 * 
 * @param {Promise} importFunc - Dynamic import function
 * @param {Object} options - Configuration options
 * @returns {React.LazyComponent} Lazy component
 * 
 * @example
 * const DashboardPage = createLazyPage(() => import('@/pages/DashboardPage'));
 */
export const createLazyPage = (
  importFunc,
  options = {}
) => {
  const {
    fallback = <PageLoadingFallback />,
    preload = true,
    onLoad = null,
  } = options;

  // Create lazy component
  const LazyComponent = React.lazy(async () => {
    const startTime = performance.now();
    
    try {
      const module = await importFunc();
      
      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Log metrics for monitoring
      if (window.__PERFORMANCE_METRICS__) {
        window.__PERFORMANCE_METRICS__.recordChunkLoadTime({
          module: importFunc.toString(),
          loadTime,
          timestamp: new Date().toISOString(),
        });
      }

      // Call optional onLoad callback
      if (onLoad) {
        onLoad({ loadTime });
      }

      console.debug(`✅ Chunk loaded in ${loadTime.toFixed(2)}ms`);

      return module;
    } catch (error) {
      console.error('❌ Chunk loading failed:', error);
      throw error;
    }
  });

  // Optional: Preload chunk on route hover
  if (preload) {
    LazyComponent.preload = importFunc;
  }

  return {
    Component: LazyComponent,
    fallback,
  };
};

/**
 * Prefetch Lazy Component
 * 
 * Preload a lazy component before it's needed.
 * Improves perceived performance by loading in background.
 * 
 * @param {Function} preloadFunc - Component preload function
 * @example
 * prefetchLazyComponent(DashboardPage.Component.preload);
 */
export const prefetchLazyComponent = (preloadFunc) => {
  if (!preloadFunc) return;

  // Preload on idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      preloadFunc();
    }, { timeout: 2000 });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      preloadFunc();
    }, 2000);
  }
};

/**
 * useChunkMetrics Hook
 * 
 * Track chunk loading metrics and performance.
 * Useful for monitoring bundle load times and identifying bottlenecks.
 * 
 * @returns {Object} Metrics object
 */
export const useChunkMetrics = () => {
  const [metrics, setMetrics] = React.useState({
    totalChunksLoaded: 0,
    averageLoadTime: 0,
    largestChunk: 0,
  });

  React.useEffect(() => {
    // Initialize metrics collection
    if (!window.__PERFORMANCE_METRICS__) {
      window.__PERFORMANCE_METRICS__ = {
        chunkLoads: [],
        recordChunkLoadTime: function(data) {
          this.chunkLoads.push(data);
          
          // Update metrics
          setMetrics({
            totalChunksLoaded: this.chunkLoads.length,
            averageLoadTime:
              this.chunkLoads.reduce((sum, c) => sum + c.loadTime, 0) /
              this.chunkLoads.length,
            largestChunk: Math.max(...this.chunkLoads.map((c) => c.loadTime)),
          });
        },
      };
    }
  }, []);

  return metrics;
};

/**
 * Route-based Preloading Strategy
 * 
 * Preload components when user hovers over navigation links.
 * Improves transition smoothness for frequently visited pages.
 */
export const setupRoutePreloading = (routes) => {
  routes.forEach((route) => {
    if (route.preload) {
      const links = document.querySelectorAll(`a[href="${route.path}"]`);
      links.forEach((link) => {
        link.addEventListener('mouseenter', () => {
          prefetchLazyComponent(route.preload);
        });
      });
    }
  });
};

/**
 * Performance Hint Component Props
 * 
 * Helper to generate optimal link preload hints for chunks.
 */
export const generatePreloadHints = (chunks) => {
  return chunks.map((chunk) => ({
    rel: 'modulepreload',
    href: chunk.url,
    as: 'script',
  }));
};

export default {
  createLazyPage,
  prefetchLazyComponent,
  useChunkMetrics,
  setupRoutePreloading,
  generatePreloadHints,
};

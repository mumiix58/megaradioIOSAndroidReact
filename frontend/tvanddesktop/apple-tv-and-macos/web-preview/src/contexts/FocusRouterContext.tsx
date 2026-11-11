import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { useLocation } from 'wouter';

/**
 * FocusRouter Context - Simple LGTV-style key routing
 * 
 * Matches LGTV reference pattern:
 * - ONE global keydown listener
 * - Routes to page-specific HandleKey(e) functions
 * - No complex spatial navigation library
 * - Pages register/unregister their handlers
 */

type KeyHandler = (e: KeyboardEvent) => void;

interface FocusRouterContextValue {
  registerHandler: (route: string, handler: KeyHandler) => void;
  unregisterHandler: (route: string) => void;
  dispatch: (e: KeyboardEvent) => void;
}

const FocusRouterContext = createContext<FocusRouterContextValue | null>(null);

export function FocusRouterProvider({ children }: { children: ReactNode }) {
  const handlersRef = useRef<Map<string, KeyHandler>>(new Map());

  // Register a handler for a specific route
  const registerHandler = (route: string, handler: KeyHandler) => {
    handlersRef.current.set(route, handler);
  };

  // Unregister a handler for a specific route
  const unregisterHandler = (route: string) => {
    handlersRef.current.delete(route);
  };

  // Dispatch key event to the handler for current route
  const dispatch = (e: KeyboardEvent) => {
    // Native text editing owns arrows (including Samsung IME caret movement).
    // Check before invoking a page handler, which may navigate or preventDefault.
    const target = e.target as HTMLElement | null;
    const editing = target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '');
    if (editing && (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
        (e.keyCode >= 37 && e.keyCode <= 40))) return;

    // Samsung TV: Use window.location.hash directly (hash-based routing)
    const hash = window.location.hash;
    let currentRoute = hash.replace('#', '') || '/';
    
    // Samsung TV fix: Default route for root/index
    if (currentRoute === '/' || currentRoute === '/index.html' || currentRoute === '') {
      currentRoute = '/guide-1';
    }
    
    // Strip query params for handler lookup (e.g., /radio-playing?station=123 -> /radio-playing)
    const routeWithoutQuery = currentRoute.split('?')[0];
    
    // Try exact match first
    let handler = handlersRef.current.get(routeWithoutQuery);
    let matchedRoute = routeWithoutQuery;
    
    // If no exact match, try base route matching (e.g., /genre-list/rock -> /genre-list)
    if (!handler) {
      const pathParts = routeWithoutQuery.split('/').filter(p => p);
      // Try progressively shorter paths (e.g., /genre-list/rock -> /genre-list)
      for (let i = pathParts.length; i > 0; i--) {
        const basePath = '/' + pathParts.slice(0, i).join('/');
        if (handlersRef.current.has(basePath)) {
          handler = handlersRef.current.get(basePath);
          matchedRoute = basePath;
          break;
        }
      }
    }
    
    if (handler) {
      handler(e);
      // Page focus is state-based. After Back, browser focus may still be on a
      // card in another carousel; its default arrow action would scroll that
      // old container as well. Run the page first (some handlers inspect
      // defaultPrevented), then consume browser scrolling for routed arrows.
      const target = e.target as HTMLElement | null;
      const editing = target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '');
      if (!editing && (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
          (e.keyCode >= 37 && e.keyCode <= 40))) e.preventDefault();
    }
  };

  // Expose dispatch to window for tv-remote-keys.js integration
  useEffect(() => {
    (window as any).focusRouterDispatch = dispatch;
    return () => {
      (window as any).focusRouterDispatch = null;
    };
  }, []);

  return (
    <FocusRouterContext.Provider value={{ registerHandler, unregisterHandler, dispatch }}>
      {children}
    </FocusRouterContext.Provider>
  );
}

// Hook to access FocusRouter
export function useFocusRouter() {
  const context = useContext(FocusRouterContext);
  if (!context) {
    throw new Error('useFocusRouter must be used within FocusRouterProvider');
  }
  return context;
}

/**
 * Hook to register a page-specific key handler (LGTV pattern)
 * 
 * Usage in a page component:
 * ```
 * usePageKeyHandler('/discover', (e) => {
 *   switch(e.keyCode) {
 *     case 13: // ENTER
 *       handleSelect();
 *       break;
 *     case 38: // UP
 *       moveFocusUp();
 *       break;
 *   }
 * });
 * ```
 */
export function usePageKeyHandler(route: string, handler: KeyHandler) {
  const { registerHandler, unregisterHandler } = useFocusRouter();
  const handlerRef = useRef(handler);

  // Keep handler ref up to date
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Register/unregister on mount/unmount
  useEffect(() => {
    const wrappedHandler = (e: KeyboardEvent) => handlerRef.current(e);
    registerHandler(route, wrappedHandler);
    return () => unregisterHandler(route);
  }, [route, registerHandler, unregisterHandler]);
}

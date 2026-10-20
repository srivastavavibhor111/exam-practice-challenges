import { useState, useEffect } from 'react';

/**
 * useIsMobile — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks whether the viewport is currently narrower than `breakpoint`,
 * updating live on resize (covers orientation changes and window
 * resizing, not just the initial render). Kept as a standalone hook
 * rather than inlined in one chart component since both Progress charts
 * need the same responsive behavior — see PerformanceTrendChart.jsx and
 * TestComparisonChart.jsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBreakpoint, BREAKPOINTS } from '../hooks/useBreakpoint';

function setWindowWidth(w) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
}

describe('useBreakpoint', () => {
  const originalWidth = window.innerWidth;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    setWindowWidth(originalWidth);
    vi.useRealTimers();
  });

  it('returns desktop at width >= 1024', () => {
    setWindowWidth(1440);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.breakpoint).toBe('desktop');
    expect(result.current.isDesktop).toBe(true);
  });

  it('returns tablet at 768 <= width < 1024', () => {
    setWindowWidth(900);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.breakpoint).toBe('tablet');
    expect(result.current.isTablet).toBe(true);
  });

  it('returns mobile at width < 768', () => {
    setWindowWidth(500);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.breakpoint).toBe('mobile');
    expect(result.current.isMobile).toBe(true);
  });

  it('updates when window is resized', () => {
    setWindowWidth(1440);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isDesktop).toBe(true);
    act(() => {
      setWindowWidth(500);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.isMobile).toBe(true);
  });

  it('uses correct breakpoint boundaries', () => {
    expect(BREAKPOINTS.mobile).toBe(768);
    expect(BREAKPOINTS.tablet).toBe(1024);
  });
});

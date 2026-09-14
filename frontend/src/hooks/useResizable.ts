"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Size = { w: number; h: number };

/**
 * Lets the user resize an element by dragging a corner handle. Works alongside
 * {@link useDraggable}: pass that hook's `nodeRef` so both measure the same
 * node. While the size is `null` the element keeps its CSS-driven dimensions;
 * once dragged it is clamped to the viewport and (optionally) persisted.
 */
export function useResizable(
  nodeRef: React.RefObject<HTMLElement | null>,
  storageKey?: string,
  opts?: { minW?: number; minH?: number },
) {
  const minW = opts?.minW ?? 240;
  const minH = opts?.minH ?? 72;
  const [size, setSize] = useState<Size | null>(null);
  const drag = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  // Restore a persisted size once, on mount.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSize(JSON.parse(raw) as Size);
    } catch {
      /* ignore malformed storage */
    }
  }, [storageKey]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const maxW = Math.max(minW, window.innerWidth - 16);
      const maxH = Math.max(minH, window.innerHeight - 16);
      setSize({
        w: Math.min(Math.max(minW, d.startW + (e.clientX - d.startX)), maxW),
        h: Math.min(Math.max(minH, d.startH + (e.clientY - d.startY)), maxH),
      });
    },
    [minW, minH],
  );

  const onPointerUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (storageKey) {
      setSize((s) => {
        if (s) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(s));
          } catch {
            /* ignore */
          }
        }
        return s;
      });
    }
  }, [onPointerMove, storageKey]);

  const handleProps = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const el = nodeRef.current;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      drag.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: rect.width,
        startH: rect.height,
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    style: { cursor: "nwse-resize", touchAction: "none" as const },
  };

  const reset = useCallback(() => {
    setSize(null);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }, [storageKey]);

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  const style: React.CSSProperties | undefined = size
    ? { width: size.w, height: size.h }
    : undefined;

  return { resizeHandleProps: handleProps, sizeStyle: style, reset, resized: size !== null };
}

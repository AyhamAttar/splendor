"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Point = { x: number; y: number };

/**
 * Makes an element draggable by a handle. Position is an absolute
 * top-left offset in viewport pixels; while it is `null` the element
 * keeps its default CSS placement. Position is clamped to the viewport
 * and (optionally) persisted to localStorage.
 */
export function useDraggable(storageKey?: string) {
  const [pos, setPos] = useState<Point | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // Restore a persisted position once, on mount.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setPos(JSON.parse(raw) as Point);
    } catch {
      /* ignore malformed storage */
    }
  }, [storageKey]);

  const clamp = useCallback((x: number, y: number): Point => {
    const el = nodeRef.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h);
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag.current) return;
      setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
    },
    [clamp],
  );

  const onPointerUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (storageKey) {
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(p));
          } catch {
            /* ignore */
          }
        }
        return p;
      });
    }
  }, [onPointerMove, storageKey]);

  const handleProps = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const el = nodeRef.current;
      if (!el) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
      // Anchor to current on-screen position so the first move is seamless.
      setPos({ x: rect.left, y: rect.top });
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    style: { cursor: "grab", touchAction: "none" as const },
  };

  const reset = useCallback(() => {
    setPos(null);
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

  const style: React.CSSProperties | undefined = pos
    ? { position: "fixed", left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : undefined;

  return { nodeRef, handleProps, style, reset, moved: pos !== null };
}

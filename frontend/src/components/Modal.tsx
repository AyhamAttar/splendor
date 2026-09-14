"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};

const MODAL_SIZE = {
  md: "max-w-md",
  lg: "max-w-2xl",
} as const;

export function Modal({
  title,
  children,
  onClose,
  dismissable = true,
  size = "md",
  panelClassName,
  panelStyle,
}: {
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  dismissable?: boolean;
  size?: keyof typeof MODAL_SIZE;
  /** Overrides the default width preset when a fixed panel size is needed. */
  panelClassName?: string;
  panelStyle?: React.CSSProperties;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissableRef = useRef(dismissable);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissableRef.current = dismissable;
  });
  const titleId = title ? "modal-title" : undefined;

  // Portal into <body> so the scrim's `position: fixed` is always relative to
  // the viewport, never trapped by a transformed/filtered ancestor (e.g. a
  // player panel's `turn-breath` animation). Gate on client render so
  // document.body is available and SSR/hydration stays consistent.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  // Focus management + Escape + a Tab focus trap. Set up once so re-renders
  // never steal focus mid-interaction; restores focus to the opener on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];
    (focusables()[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissableRef.current) {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="modal-scrim scrim-in fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={dismissable ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={panelStyle}
        className={`rise-in gold-frame relative overflow-hidden rounded-xl bg-navy-800 p-5 shadow-raise-3 focus:outline-none ${
          panelClassName ?? `w-full ${MODAL_SIZE[size]}`
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold-300/45 to-transparent" />
        {title && (
          <h3
            id={titleId}
            className="flex flex-row justify-center font-display text-engrave-gold mb-4  pb-4 text-xl text-gold-300"
          >
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

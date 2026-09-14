"use client";

import { createContext, useContext } from "react";

/** Anything on the table that can be opened in the details modal. */
export type Inspectable =
  | { kind: "dev"; cardId: number }
  | { kind: "noble"; nobleId: number };

const CardInspectContext = createContext<((x: Inspectable) => void) | null>(
  null,
);

export const CardInspectProvider = CardInspectContext.Provider;

/**
 * Returns a function that opens the shared card-details modal. Safe to call
 * outside a provider (it just no-ops), so components stay usable in isolation.
 */
export function useInspect(): (x: Inspectable) => void {
  const open = useContext(CardInspectContext);
  return open ?? noop;
}

function noop() {
  /* no provider mounted */
}

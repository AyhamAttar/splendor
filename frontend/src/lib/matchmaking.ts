import { authedFetch } from "./auth";

/** Quick-match queue status for the polling client. */
export type QueueStatus =
  | { status: "idle" }
  | { status: "searching"; size: number; target: number }
  | { status: "matched"; gameId: string };

/**
 * Public quick-match API. The client joins the queue then polls `status` until
 * it reports `matched` (with the online game id) — all identity-scoped.
 */
export const matchmakingApi = {
  join: (name: string) =>
    authedFetch<QueueStatus>("/matchmaking/queue", {
      method: "POST",
      body: { name },
    }),

  leave: () =>
    authedFetch<void>("/matchmaking/queue", { method: "DELETE" }),

  status: () => authedFetch<QueueStatus>("/matchmaking/status"),
};

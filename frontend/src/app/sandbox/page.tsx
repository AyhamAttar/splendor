"use client";

import Link from "next/link";
import { GameView } from "@/components/GameScreen";
import { useLocalGame } from "@/hooks/useLocalGame";

/**
 * Dev-only test harness. Renders the REAL game board + dialogs backed by a
 * fully local, in-memory engine (no backend, no login), with a floating DevMenu
 * for jumping straight to scenarios — buying, noble visits, over-10 returns,
 * near-win / game-over — instead of playing a whole game. Disabled in prod.
 */
export default function SandboxPage() {
  const { game, dev } = useLocalGame(2);

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="gold-frame max-w-sm rounded-lg bg-navy-800/70 p-6">
          <p className="text-parchment-100">
            The sandbox is a development-only tool and is disabled in production.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-gold-300 underline hover:text-gold-400"
          >
            Back to lobby
          </Link>
        </div>
      </div>
    );
  }

  return <GameView game={game} dev={dev} />;
}

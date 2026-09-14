import { GameScreen } from "@/components/GameScreen";

// Thin server component: unwrap the async route param + search params (Next
// 15+), then hand off to the client GameScreen. `?online=1` selects the
// identity-authed, WebSocket-driven online mode (games created by a room or
// quick-match); otherwise it's a local hotseat game keyed by the session token.
export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ online?: string }>;
}) {
  const { gameId } = await params;
  const { online } = await searchParams;
  return <GameScreen gameId={gameId} online={online === "1"} />;
}

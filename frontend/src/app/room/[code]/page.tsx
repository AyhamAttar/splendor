import { RoomScreen } from "@/components/RoomScreen";

// Thin server component: unwrap the async route param (Next 15+) and normalise
// the invite code before handing off to the client RoomScreen.
export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomScreen code={code.toUpperCase()} />;
}

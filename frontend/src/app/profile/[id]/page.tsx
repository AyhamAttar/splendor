import { ProfileScreen } from "@/components/ProfileScreen";

// Thin server component: unwrap the async route param (Next 16), then hand off
// to the client ProfileScreen, which fetches the public profile + match history.
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProfileScreen userId={id} />;
}

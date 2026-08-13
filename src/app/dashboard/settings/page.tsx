import { getCurrentUser } from "@/lib/auth";
import { listTemplates } from "@/lib/campaigns";
import SettingsPage from "@/components/dashboard/SettingsPage";

export const dynamic = "force-dynamic";

export default async function SettingsRoute() {
  const user = await getCurrentUser();
  const templates = listTemplates(user!.id);
  return (
    <SettingsPage
      templates={templates}
      email={user!.email}
      fullName={user!.full_name}
      phone={user!.phone}
    />
  );
}

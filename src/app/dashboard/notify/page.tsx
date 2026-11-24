import { unstable_noStore as noStore } from "next/cache";
import { DashboardNotifyReminders } from "@/components/DashboardNotifyReminders";
import type { HoodieReminderAdminRow } from "@/lib/hoodieReminders";
import { listHoodieReminders } from "@/lib/hoodieReminders.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardNotifyPage() {
  noStore();
  let reminders: HoodieReminderAdminRow[] = [];
  try {
    reminders = await listHoodieReminders();
  } catch {
    reminders = [];
  }

  return <DashboardNotifyReminders reminders={reminders} />;
}

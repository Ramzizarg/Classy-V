import { redirect } from "next/navigation";

/** The back office lives at /dashboard (Vero7-style). Keep /admin as an alias. */
export default function AdminIndexPage() {
  redirect("/dashboard");
}

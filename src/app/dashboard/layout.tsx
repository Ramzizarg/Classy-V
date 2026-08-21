import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DashboardThemeSync } from "@/components/DashboardThemeSync";
import { isAdminAuthenticated } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthenticated())) {
    redirect("/login?next=/dashboard");
  }

  return (
    // Outer wrapper stays unzoomed so the white background always covers the
    // full viewport (otherwise the storefront black body shows through).
    <div className="dashboard-shell min-h-screen bg-white text-black" style={{ colorScheme: "light" }}>
      <DashboardThemeSync />
      <div
        // Opts the back office out of the storefront's 11px monospace type scale,
        // and renders it at 80% like a browser zoom-out.
        style={{
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: "14px",
          lineHeight: 1.5,
          letterSpacing: "normal",
          zoom: 0.8,
        }}
      >
        <DashboardHeader />
        <div className="px-4 sm:px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

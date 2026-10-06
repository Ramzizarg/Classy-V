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
        // Back office uses a readable UI font. `dashboard-zoom` scales the
        // desktop layout down; phones stay at 100% so content is not clipped.
        className="dashboard-zoom"
        style={{
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: "14px",
          lineHeight: 1.5,
          letterSpacing: "normal",
        }}
      >
        <DashboardHeader />
        <div className="dashboard-main w-full max-w-full min-w-0 px-3 py-4 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}

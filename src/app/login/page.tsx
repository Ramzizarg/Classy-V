import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { SITE } from "@/lib/site";
import { LoginFormPanel } from "./LoginFormPanel";

export const metadata: Metadata = {
  title: "Login",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  const { error } = await searchParams;
  const hasError = error === "1";

  return (
    <section className="flex min-h-[calc(100dvh-var(--header-height))] flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:justify-center lg:px-10 lg:py-12 xl:px-16">
        <div className="flex flex-1 flex-col border-line bg-surface/50 lg:border lg:px-12 lg:py-14 xl:px-16 xl:py-16">
          <div className="flex justify-end px-4 pt-3 sm:px-6 lg:hidden">
            <a href="/" className="ui text-muted hover-underline">
              Shop
            </a>
          </div>

          <div className="grid flex-1 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="flex flex-1 flex-col px-4 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-8 lg:justify-center lg:px-0 lg:py-0">
              <div className="mb-6 flex justify-center lg:hidden">
                <BrandMark width={150} />
              </div>
              <LoginFormPanel hasError={hasError} />
            </div>

            <aside className="hidden h-full min-h-[14rem] flex-col justify-between border-l border-line pl-16 lg:flex">
              <div>
                <BrandMark width={165} />
                <h2 className="page-title mt-10">Back office</h2>
                <p className="prose-raw mt-4 max-w-md text-muted">
                  Review orders and update shipping status for {SITE.name}.
                </p>
              </div>
              <a href="/" className="ui mt-12 inline-flex text-muted hover-underline">
                Return to storefront
              </a>
            </aside>
          </div>

          <p className="mt-auto border-t border-line px-4 py-4 text-center ui-sm text-muted sm:px-6 lg:hidden">
            {SITE.name} back office · staff only
          </p>
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import { BrandMark } from "@/components/BrandMark";
import { SITE } from "@/lib/site";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ResetPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPageProps) {
  const { token } = await searchParams;
  const resetToken = token?.trim() ?? "";

  return (
    <section className="flex min-h-[calc(100dvh-var(--header-height))] flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:justify-center lg:px-10 lg:py-12 xl:px-16">
        <div className="flex flex-1 flex-col border-line bg-surface/50 lg:border lg:px-12 lg:py-14 xl:px-16 xl:py-16">
          <div className="flex justify-end px-4 pt-3 sm:px-6 lg:hidden">
            <a href="/login" className="ui text-muted hover-underline">
              Sign in
            </a>
          </div>

          <div className="grid flex-1 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="flex flex-1 flex-col px-4 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-8 lg:justify-center lg:px-0 lg:py-0">
              <div className="mb-6 flex justify-center lg:hidden">
                <BrandMark width={150} />
              </div>
              <ResetPasswordForm token={resetToken} />
            </div>

            <aside className="hidden h-full min-h-[14rem] flex-col items-start justify-between border-l border-line pl-16 lg:flex">
              <div className="text-left">
                <BrandMark width={165} />
                <h2 className="page-title mt-10">Choose a new password</h2>
                <p className="prose-raw mt-4 max-w-md text-muted">
                  Links expire after 30 minutes. After saving, sign in to the {SITE.name} back
                  office with your new password.
                </p>
              </div>
              <a href="/login" className="ui inline-flex text-muted hover-underline">
                Back to sign in
              </a>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

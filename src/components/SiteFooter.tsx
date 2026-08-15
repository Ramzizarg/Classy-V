import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line px-3 py-4 sm:px-4">
      <p className="ui-sm text-center text-muted">
        Copyright © {new Date().getFullYear()}, {SITE.legalName}.
      </p>
    </footer>
  );
}

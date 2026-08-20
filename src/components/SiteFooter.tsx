import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer__copy ui-sm">
        Copyright © {new Date().getFullYear()}, {SITE.legalName}.
      </p>
    </footer>
  );
}

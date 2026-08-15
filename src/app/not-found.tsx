import Link from "next/link";

export default function NotFound() {
  return (
    <section className="px-3 pb-16 sm:px-4">
      <h1 className="page-title">404 — page not found</h1>
      <p className="prose-raw mt-3 max-w-md">
        That page does not exist. It may have sold out and been retired with its drop.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/collection" className="btn btn--solid">
          Shop all products
        </Link>
        <Link href="/" className="btn">
          Back home
        </Link>
      </div>
    </section>
  );
}

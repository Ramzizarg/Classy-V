import { buildFacebookCatalogCsv, type FacebookCatalogSet } from "@/lib/facebookCatalog";
import { getCatalog } from "@/lib/storefrontCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function catalogSet(value: string | null): FacebookCatalogSet {
  return value === "all" ? "all" : "joggers";
}

/** Public Meta Commerce feed — paste this URL in Facebook catalog, or download the file. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const set = catalogSet(url.searchParams.get("set"));
  const download = url.searchParams.get("download") === "1";
  const csv = buildFacebookCatalogCsv(await getCatalog(), set);
  const filename = set === "joggers" ? "classy-v-joggers-facebook.csv" : "classy-v-facebook-catalog.csv";

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "public, max-age=300",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
    },
  });
}

/** Dev helper: print the built CSS rules that match a term. Usage: node scripts/check-css.mjs term */
const term = process.argv[2] ?? "btn--solid";
const html = await (await fetch("http://localhost:3000/collection/handwritten-denim-jacket")).text();
const href = html.match(/\/_next\/static\/[^"']+\.css/)?.[0];
if (!href) throw new Error("No stylesheet found in page HTML.");

const css = await (await fetch(`http://localhost:3000${href}`)).text();
console.log(href, css.length, "bytes");

for (const match of css.matchAll(new RegExp(`[^{}]*${term}[^{]*\\{[^}]*\\}`, "g"))) {
  console.log(match[0].trim());
}

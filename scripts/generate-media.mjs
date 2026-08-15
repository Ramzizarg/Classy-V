/**
 * Builds the placeholder visual set (catalog, editorial, brand marks) as SVG so the
 * store runs with zero external assets. Drop real photography into `public/products`
 * and `public/media` with the same file names to replace it.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

const SILHOUETTES = {
  tee: "M330 150 L250 178 L196 268 L262 306 L286 268 L286 760 L594 760 L594 268 L618 306 L684 268 L630 178 L550 150 C520 208 460 224 440 224 C420 224 360 208 330 150 Z",
  hoodie:
    "M336 168 L246 206 L188 316 L258 352 L286 312 L286 792 L594 792 L594 312 L622 352 L692 316 L634 206 L544 168 C536 236 496 262 440 262 C384 262 344 236 336 168 Z M352 470 L528 470 L528 566 L352 566 Z",
  crew: "M334 160 L240 196 L190 322 L262 356 L288 314 L288 776 L592 776 L592 314 L618 356 L690 322 L640 196 L546 160 C528 212 492 230 440 230 C388 230 352 212 334 160 Z",
  jacket:
    "M338 158 L242 200 L192 330 L264 364 L290 320 L290 786 L590 786 L590 320 L616 364 L688 330 L638 200 L542 158 L440 268 Z",
  pants:
    "M304 200 L576 200 L594 336 L568 800 L468 800 L440 470 L412 800 L312 800 L286 336 Z",
  shorts: "M300 226 L580 226 L596 350 L572 560 L470 560 L440 400 L410 560 L308 560 L284 350 Z",
  cap: "M204 546 C204 386 310 268 440 268 C570 268 676 386 676 546 L640 566 L240 566 Z M204 546 L760 546 C760 612 700 636 640 636 L204 636 Z",
  beanie:
    "M232 560 C232 396 326 288 440 288 C554 288 648 396 648 560 L648 594 L232 594 Z M204 594 L676 594 L676 690 L204 690 Z",
  bag: "M292 320 L588 320 L620 800 L260 800 Z M366 320 C366 226 400 178 440 178 C480 178 514 226 514 320",
  tank: "M352 168 L318 196 L318 300 L352 312 L352 772 L528 772 L528 312 L562 300 L562 196 L528 168 C520 226 486 250 440 250 C394 250 360 226 352 168 Z",
  vest: "M336 168 L292 200 L292 372 L336 386 L336 776 L544 776 L544 386 L588 372 L588 200 L544 168 L440 330 Z",
  socks:
    "M300 196 L404 196 L404 560 C404 626 366 668 306 668 C250 668 214 630 214 574 C214 528 246 500 300 494 Z M476 196 L580 196 L580 560 C580 626 542 668 482 668 C426 668 390 630 390 574 C390 528 422 500 476 494 Z",
};

/** Ink bounds of each silhouette, used to frame every garment the same way. */
const BOUNDS = {
  tee: [196, 150, 684, 760],
  hoodie: [188, 168, 692, 792],
  crew: [190, 160, 690, 776],
  jacket: [192, 158, 688, 786],
  pants: [286, 200, 594, 800],
  shorts: [284, 226, 596, 560],
  cap: [204, 268, 760, 636],
  beanie: [204, 288, 676, 690],
  bag: [260, 178, 620, 800],
  tank: [318, 168, 562, 772],
  vest: [292, 168, 588, 776],
  socks: [214, 196, 580, 668],
};

/** Construction lines drawn over the silhouette so shapes read as garments. */
const DETAILS = {
  jacket: ["M440 268 L440 786", "M338 158 L440 268 L542 158"],
  hoodie: ["M440 262 L440 470"],
  pants: ["M440 200 L440 470", "M304 240 L576 240"],
  shorts: ["M440 226 L440 400", "M300 264 L580 264"],
  socks: ["M300 250 L404 250", "M476 250 L580 250"],
  vest: ["M336 386 L544 386"],
  bag: ["M292 420 L588 420"],
};

const escapeXml = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const channels = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));

const luminance = (hex) => {
  const [r, g, b] = channels(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/** Blend a colour toward white so a near-black garment still reads on black paper. */
const lift = (hex, amount) => {
  const mixed = channels(hex).map((value) => Math.round(value + (255 - value) * amount));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
};

/**
 * Square catalog frame with a transparent ground so the garment floats on the
 * storefront's black paper, the way a cut-out product shot would. Dark cloth is
 * lifted and edged so the silhouette never disappears into the background.
 */
/** Scale + centre a silhouette inside the frame, so tiles line up down the grid. */
function frame(shape) {
  const [x0, y0, x1, y1] = BOUNDS[shape] ?? BOUNDS.tee;
  const width = x1 - x0;
  const height = y1 - y0;
  const scale = Math.min(920 / width, 940 / height, 2.05);
  const dx = 500 - (x0 + width / 2) * scale;
  const dy = 500 - (y0 + height / 2) * scale;

  return `translate(${dx.toFixed(1)},${dy.toFixed(1)}) scale(${scale.toFixed(3)})`;
}

function productSvg({ label, shape, base, accent, view }) {
  const silhouette = SILHOUETTES[shape] ?? SILHOUETTES.tee;
  const dark = Math.max(0, 0.34 - luminance(base)) / 0.34;
  const cloth = lift(base, dark * 0.3);
  const highlight = lift(accent, dark * 0.34);
  const seams = (DETAILS[shape] ?? [])
    .map(
      (path) =>
        `\n    <path d="${path}" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="2"/>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" role="img" aria-label="${escapeXml(label)} — ${escapeXml(view)}">
  <defs>
    <linearGradient id="cloth" x1="0.2" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="${highlight}"/>
      <stop offset="0.55" stop-color="${cloth}"/>
      <stop offset="1" stop-color="${cloth}"/>
    </linearGradient>
  </defs>
  <g transform="${frame(shape)}">
    <path d="${silhouette}" fill="url(#cloth)" fill-rule="evenodd"/>
    <path d="${silhouette}" fill="none" fill-rule="evenodd" stroke="#ffffff" stroke-opacity="${(0.2 + dark * 0.35).toFixed(2)}" stroke-width="2.5"/>${seams}
  </g>
</svg>
`;
}

function editorialSvg({ eyebrow, title, tone = "dark", ratio = "16:9" }) {
  const [w, h] = ratio === "16:9" ? [1600, 900] : ratio === "4:5" ? [1000, 1250] : [1400, 1400];
  const dark = tone === "dark";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${dark ? "#1c1c20" : "#fafafa"}"/>
      <stop offset="0.5" stop-color="${dark ? "#0d0d10" : "#ededf0"}"/>
      <stop offset="1" stop-color="${dark ? "#000000" : "#dededf"}"/>
    </linearGradient>
    <radialGradient id="spot" cx="0.3" cy="0.2" r="0.85">
      <stop offset="0" stop-color="${dark ? "#ffffff" : "#ffffff"}" stop-opacity="${dark ? 0.14 : 0.85}"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <pattern id="lines" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
      <line x1="0" y1="0" x2="0" y2="46" stroke="${dark ? "#ffffff" : "#000000"}" stroke-opacity="0.05" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#base)"/>
  <rect width="${w}" height="${h}" fill="url(#lines)"/>
  <rect width="${w}" height="${h}" fill="url(#spot)"/>
  <g fill="${dark ? "#ffffff" : "#0b0b0c"}">
    <text x="${w / 2}" y="${h / 2 - 40}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="${Math.round(w / 46)}" font-weight="700" letter-spacing="14" opacity="0.65">${escapeXml(eyebrow)}</text>
    <text x="${w / 2}" y="${h / 2 + Math.round(w / 22)}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="${Math.round(w / 13)}" font-weight="900" letter-spacing="-2">${escapeXml(title)}</text>
  </g>
</svg>
`;
}

const PRODUCT_MEDIA = [
  { slug: "classic-v-heavy-tee", label: "CLASSIC V HEAVY TEE", shape: "tee", base: "#f2efe8", accent: "#ffffff" },
  { slug: "monogram-boxy-tee", label: "MONOGRAM BOXY TEE", shape: "tee", base: "#141416", accent: "#3a3a40", tone: "dark" },
  { slug: "legacy-washed-hoodie", label: "LEGACY WASHED HOODIE", shape: "hoodie", base: "#2b2b30", accent: "#4c4c54" },
  { slug: "atelier-cream-hoodie", label: "ATELIER CREAM HOODIE", shape: "hoodie", base: "#e8dfd0", accent: "#fbf7f0" },
  { slug: "signature-crewneck", label: "SIGNATURE CREWNECK", shape: "crew", base: "#9a9aa2", accent: "#c8c8ce" },
  { slug: "varsity-wool-jacket", label: "VARSITY WOOL JACKET", shape: "jacket", base: "#1d2a44", accent: "#3d5480" },
  { slug: "coach-jacket-noir", label: "COACH JACKET NOIR", shape: "jacket", base: "#101014", accent: "#2f2f38", tone: "dark" },
  { slug: "tailored-cargo-pant", label: "TAILORED CARGO PANT", shape: "pants", base: "#4a4f3a", accent: "#6d7455" },
  { slug: "pleated-wide-trouser", label: "PLEATED WIDE TROUSER", shape: "pants", base: "#33333a", accent: "#55555f" },
  { slug: "essential-sweat-short", label: "ESSENTIAL SWEAT SHORT", shape: "shorts", base: "#cdbfa8", accent: "#e6dcc9" },
  { slug: "crown-v-fitted-cap", label: "CROWN V FITTED CAP", shape: "cap", base: "#121216", accent: "#33333c", tone: "dark" },
  { slug: "aged-black-strapback", label: "AGED BLACK STRAPBACK", shape: "cap", base: "#2a2a2c", accent: "#4b4b50" },
  { slug: "dreamers-beanie", label: "DREAMERS BEANIE", shape: "beanie", base: "#7a2230", accent: "#a8404f" },
  { slug: "studio-canvas-tote", label: "STUDIO CANVAS TOTE", shape: "bag", base: "#ddd6c6", accent: "#f2ece0" },
  { slug: "open-mesh-panel-jersey", label: "OPEN MESH PANEL JERSEY", shape: "tee", base: "#20372a", accent: "#3d5f49" },
  { slug: "rugby-league-jersey", label: "RUGBY LEAGUE JERSEY", shape: "tee", base: "#1e3a8a", accent: "#3b5fc0" },
  { slug: "vice-mesh-knit-vest", label: "VICE MESH KNIT VEST", shape: "vest", base: "#4d5233", accent: "#6f764b" },
  { slug: "handwritten-denim-jacket", label: "HANDWRITTEN DENIM JACKET", shape: "jacket", base: "#3f5c86", accent: "#5f81ad" },
  { slug: "handwritten-baggy-jean", label: "HANDWRITTEN BAGGY JEAN", shape: "pants", base: "#405f8a", accent: "#6285b0" },
  { slug: "monogram-socks-2pk", label: "MONOGRAM SOCKS 2PK", shape: "socks", base: "#1a1a1a", accent: "#3d3d3d" },
  { slug: "womens-classic-tank", label: "WOMENS CLASSIC TANK", shape: "tank", base: "#f5f5f2", accent: "#ffffff" },
];

const EDITORIAL_MEDIA = [
  { file: "media/hero.svg", eyebrow: "FROM VALENCIA TO THE WORLD", title: "CLASSY V", ratio: "16:9" },
  { file: "media/about.svg", eyebrow: "THE ATELIER", title: "CRAFT FIRST", ratio: "4:5" },
  { file: "media/lookbook-1.svg", eyebrow: "CHAPTER 01", title: "NIGHT SHIFT", ratio: "4:5" },
  { file: "media/lookbook-2.svg", eyebrow: "CHAPTER 02", title: "CITY LINEN", ratio: "4:5", tone: "light" },
  { file: "media/lookbook-3.svg", eyebrow: "CHAPTER 03", title: "OFF DUTY", ratio: "4:5" },
  { file: "media/lookbook-4.svg", eyebrow: "CHAPTER 04", title: "MONOCHROME", ratio: "4:5", tone: "light" },
  { file: "media/lookbook-5.svg", eyebrow: "CHAPTER 05", title: "AFTER HOURS", ratio: "4:5" },
  { file: "media/collection-banner.svg", eyebrow: "SEASON 01", title: "THE FULL RANGE", ratio: "16:9" },
  { file: "media/club.svg", eyebrow: "MEMBERS ONLY", title: "THE CLASSY CIRCLE", ratio: "16:9", tone: "light" },
];

const BRAND_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" width="520" height="120" role="img" aria-label="Classy V">
  <text x="0" y="86" font-family="Inter, Helvetica, Arial, sans-serif" font-size="86" font-weight="900" letter-spacing="6" fill="currentColor">CLASSY</text>
  <text x="392" y="86" font-family="Inter, Helvetica, Arial, sans-serif" font-size="86" font-weight="300" letter-spacing="0" fill="currentColor">V</text>
</svg>
`;

const BRAND_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Classy V monogram">
  <rect width="128" height="128" rx="28" fill="#0a0a0b"/>
  <path d="M38 40 L64 92 L90 40" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="64" cy="26" r="5" fill="#ffffff"/>
</svg>
`;

async function write(relativePath, contents) {
  const target = join(publicDir, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, "utf8");
}

async function main() {
  for (const product of PRODUCT_MEDIA) {
    await write(
      `products/${product.slug}-1.svg`,
      productSvg({ ...product, view: "FRONT VIEW" })
    );
    await write(
      `products/${product.slug}-2.svg`,
      productSvg({
        ...product,
        base: product.accent,
        accent: product.base,
        view: "BACK VIEW",
      })
    );
    await write(
      `products/${product.slug}-3.svg`,
      productSvg({ ...product, tone: product.tone === "dark" ? "light" : "dark", view: "DETAIL" })
    );
  }

  for (const item of EDITORIAL_MEDIA) {
    await write(item.file, editorialSvg(item));
  }

  await write("brand/logo.svg", BRAND_LOGO);
  await write("brand/mark.svg", BRAND_MARK);

  console.log(
    `Generated ${PRODUCT_MEDIA.length * 3} product images, ${EDITORIAL_MEDIA.length} editorial images and 2 brand marks.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

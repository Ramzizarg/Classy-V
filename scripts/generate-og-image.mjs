/**
 * Social link preview (Instagram / Facebook / etc.): white canvas, smaller black logo.
 */
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGO_SOURCE = join(root, "public", "brand", "classy-v-splash.png");
const WIDTH = 1200;
const HEIGHT = 630;
const LOGO_WIDTH = 300;

const TARGETS = [
  join(root, "src", "app", "opengraph-image.png"),
  join(root, "src", "app", "twitter-image.png"),
  join(root, "public", "og-image.png"),
];

async function buildOgImage() {
  const logo = await sharp(await readFile(LOGO_SOURCE))
    .resize({ width: LOGO_WIDTH, withoutEnlargement: true })
    .negate({ alpha: false })
    .toBuffer();

  const canvas = sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  }).composite([{ input: logo, gravity: "center" }]);

  const png = await canvas.png().toBuffer();

  for (const target of TARGETS) {
    await mkdir(dirname(target), { recursive: true });
    await sharp(png).toFile(target);
    console.log(`${WIDTH}x${HEIGHT} -> ${target}`);
  }
}

buildOgImage().catch((error) => {
  console.error(error);
  process.exit(1);
});

import sharp from "sharp";
import fs from "fs";

const productPath =
  "C:/Users/client/.cursor/projects/c-Users-client-Desktop-Classy-V/assets/classy-v-joggers-cutout-white.jpg";
const logoPath =
  "C:/Users/client/.cursor/projects/c-Users-client-Desktop-Classy-V/assets/loogo-1847571a-b84f-4a9e-8bed-97449c1af260.png";
const outPath = "C:/Users/client/Desktop/Classy-V/public/ads/classy-v-300gsm-ad.jpg";
const assetsOut =
  "C:/Users/client/.cursor/projects/c-Users-client-Desktop-Classy-V/assets/classy-v-300gsm-ad.jpg";

const W = 1080;
const H = 1440;
const barH = Math.round(H * 0.22);
const photoH = H - barH;

async function trimLogo(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 10) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return sharp(path)
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize({ width: Math.round(W * 0.13) })
    .png()
    .toBuffer();
}

/** Crop to non-white subject so we can pin the figure to the right edge. */
async function cropSubject(path) {
  const { data, info } = await sharp(path)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // treat near-white as background
      if (r > 245 && g > 245 && b > 245) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(info.width - 1, maxX + pad);
  maxY = Math.min(info.height - 1, maxY + pad);

  return sharp(path)
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
}

const subject = await cropSubject(productPath);

// Tall figure, flush to the right like MECAB
const personTargetH = Math.round(photoH * 0.98);
const personBuf = await sharp(subject)
  .resize({ height: personTargetH, fit: "inside" })
  .png()
  .toBuffer();

const personMeta = await sharp(personBuf).metadata();
const rightGap = Math.round(W * 0.005);
const personLeft = W - (personMeta.width || 0) - rightGap;
const personTop = Math.round((photoH - (personMeta.height || personTargetH)) / 2);

const logoTrimmed = await trimLogo(logoPath);
const logoMeta = await sharp(logoTrimmed).metadata();
const margin = Math.round(W * 0.04);

const leftPad = Math.round(W * 0.055);
const rightPad = Math.round(W * 0.055);
const gsmSize = Math.round(barH * 0.22);
const arSize = Math.round(barH * 0.078);
const footSize = Math.round(barH * 0.05);
const priceNumSize = Math.round(barH * 0.36);
const priceDtSize = Math.round(barH * 0.13);
const priceLabelSize = Math.round(barH * 0.055);

const arabic = "قماش ما يفلّفِلش ويدوم";

const barSvg = Buffer.from(`<svg width="${W}" height="${barH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="redGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d62158"/>
      <stop offset="100%" stop-color="#c9184a"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${barH}" fill="url(#redGrad)"/>
  <style>
    .gsm { fill: #ffffff; font-family: Arial Black, Arial, Helvetica, sans-serif; font-weight: 900; font-size: ${gsmSize}px; }
    .ar { fill: #ffe6ee; font-family: 'Segoe UI', 'Arial', sans-serif; font-size: ${arSize}px; font-weight: 600; }
    .foot { fill: #ffd0de; font-family: Arial, Helvetica, sans-serif; font-size: ${footSize}px; letter-spacing: 1.6px; font-weight: 600; }
    .priceLabel { fill: #ffd0de; font-family: Arial, Helvetica, sans-serif; font-size: ${priceLabelSize}px; letter-spacing: 2.5px; font-weight: 700; }
    .priceNum { fill: #ffffff; font-family: Arial Black, Arial, Helvetica, sans-serif; font-size: ${priceNumSize}px; font-weight: 900; }
    .priceDt { fill: #ffffff; font-family: Arial Black, Arial, Helvetica, sans-serif; font-size: ${priceDtSize}px; font-weight: 900; }
  </style>

  <!-- LEFT: GSM + Arabic + footer -->
  <text x="${leftPad}" y="${Math.round(barH * 0.34)}" text-anchor="start" class="gsm">300 GSM</text>
  <text x="${leftPad}" y="${Math.round(barH * 0.55)}" text-anchor="start" class="ar">${arabic}</text>
  <text x="${leftPad}" y="${Math.round(barH * 0.88)}" text-anchor="start" class="foot">CLASSY V  ·  PAIEMENT À LA LIVRAISON</text>

  <!-- RIGHT TOP: price -->
  <text x="${W - rightPad}" y="${Math.round(barH * 0.2)}" text-anchor="end" class="priceLabel">PRIX</text>
  <text x="${W - rightPad}" y="${Math.round(barH * 0.62)}" text-anchor="end" class="priceNum">65 DT</text>
</svg>`);

const barWithText = await sharp(barSvg).png().toBuffer();

const canvas = await sharp({
  create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .composite([
    { input: personBuf, left: Math.max(0, personLeft), top: Math.max(0, personTop) },
    { input: logoTrimmed, left: margin, top: margin },
    { input: barWithText, left: 0, top: photoH },
  ])
  .jpeg({ quality: 94, mozjpeg: true })
  .toBuffer();

const tmp = outPath.replace(/\.jpg$/, "-new.jpg");
fs.writeFileSync(tmp, canvas);
fs.writeFileSync(assetsOut, canvas);

try {
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
} catch {
  /* locked */
}

try {
  fs.renameSync(tmp, outPath);
} catch {
  const alt = outPath.replace(/\.jpg$/, "-v2.jpg");
  fs.copyFileSync(tmp, alt);
  console.log("wrote", alt);
}

console.log("done", {
  W,
  H,
  personLeft,
  personW: personMeta.width,
  personH: personMeta.height,
  logoW: logoMeta.width,
  outPath,
});

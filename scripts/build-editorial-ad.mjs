import sharp from "sharp";
import fs from "fs";

const platePath =
  "C:/Users/client/.cursor/projects/c-Users-client-Desktop-Classy-V/assets/classy-v-joggers-editorial-plate.jpg";
const logoPath =
  "C:/Users/client/.cursor/projects/c-Users-client-Desktop-Classy-V/assets/loogo-1847571a-b84f-4a9e-8bed-97449c1af260.png";
const outPath = "C:/Users/client/Desktop/Classy-V/public/ads/classy-v-joggers-editorial.jpg";
const assetsOut =
  "C:/Users/client/.cursor/projects/c-Users-client-Desktop-Classy-V/assets/classy-v-joggers-editorial.jpg";

const W = 1080;
const H = 1440;
const thinBarH = Math.round(H * 0.055);

async function trimLogo(path, width) {
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
    .resize({ width })
    .png()
    .toBuffer();
}

const photo = await sharp(platePath)
  .resize(W, H - thinBarH, {
    fit: "cover",
    position: "centre",
  })
  .jpeg()
  .toBuffer();

const logo = await trimLogo(logoPath, Math.round(W * 0.11));
const logoMeta = await sharp(logo).metadata();
const margin = Math.round(W * 0.045);

// REPRESENT-style: big brand word on the right mid-height
const brandSize = Math.round(W * 0.078);
const detailSize = Math.round(W * 0.026);
const priceSize = Math.round(W * 0.045);
const arabicSize = Math.round(W * 0.026);
const rightX = W - Math.round(W * 0.05);
const brandY = Math.round((H - thinBarH) * 0.22);

const overlay = Buffer.from(`<svg width="${W}" height="${H - thinBarH}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .brand {
      fill: #111111;
      font-family: Arial Black, Impact, Arial, Helvetica, sans-serif;
      font-weight: 900;
      font-size: ${brandSize}px;
      letter-spacing: 4px;
    }
    .detail {
      fill: #222222;
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${detailSize}px;
      letter-spacing: 3px;
      font-weight: 700;
    }
    .price {
      fill: #c9184a;
      font-family: Arial Black, Arial, Helvetica, sans-serif;
      font-size: ${priceSize}px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .ar {
      fill: #333333;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: ${arabicSize}px;
      font-weight: 600;
    }
  </style>

  <!-- Right side brand like REPRESENT -->
  <text x="${rightX}" y="${brandY}" text-anchor="end" class="brand">CLASSY</text>
  <text x="${rightX}" y="${brandY + Math.round(brandSize * 0.55)}" text-anchor="end" class="detail">300 GSM</text>
  <text x="${rightX}" y="${brandY + Math.round(brandSize * 1.05)}" text-anchor="end" class="price">65 DT</text>

  <!-- Left subtle Arabic -->
  <text x="${margin}" y="${Math.round((H - thinBarH) * 0.92)}" text-anchor="start" class="ar">قماش ما يفلّفِلش ويدوم</text>
</svg>`);

const thinBar = Buffer.from(`<svg width="${W}" height="${thinBarH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${thinBarH}" fill="#c9184a"/>
  <text x="50%" y="${Math.round(thinBarH * 0.68)}" text-anchor="middle"
    fill="#ffffff"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${Math.round(thinBarH * 0.38)}"
    font-weight="700"
    letter-spacing="3">CLASSY V  ·  PAIEMENT À LA LIVRAISON</text>
</svg>`);

const photoWithType = await sharp(photo)
  .composite([
    { input: overlay, left: 0, top: 0 },
    { input: logo, left: margin, top: margin },
  ])
  .png()
  .toBuffer();

const barBuf = await sharp(thinBar).png().toBuffer();

const canvas = await sharp({
  create: { width: W, height: H, channels: 3, background: { r: 245, g: 245, b: 245 } },
})
  .composite([
    { input: photoWithType, left: 0, top: 0 },
    { input: barBuf, left: 0, top: H - thinBarH },
  ])
  .jpeg({ quality: 94, mozjpeg: true })
  .toBuffer();

fs.writeFileSync(outPath, canvas);
fs.writeFileSync(assetsOut, canvas);

console.log("done", {
  W,
  H,
  thinBarH,
  logoW: logoMeta.width,
  outPath,
});

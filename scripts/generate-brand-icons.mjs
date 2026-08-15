/**
 * Turns the painted brand marks into the browser tab / app icons: each mark is
 * trimmed to its ink bounding box, recoloured and dropped inside a dark disc.
 * Pure Node (zlib only) so the asset pipeline stays dependency free.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ICON_SOURCE = { file: join(root, "public", "brand", "classy V.png") };
/** The sparkle lockup is painted the other way round: white mark on black paper. */
const RAIL_SOURCE = { file: join(root, "public", "brand", "Classy V 2.png"), lightInk: true };
const SPLASH_SOURCE = { file: join(root, "public", "brand", "classy v 4.png"), lightInk: true };

const DISC = [10, 10, 11];
/** Tab and app icons are stamped in brand yellow; the storefront rail mark stays white. */
const ICON_INK = [255, 212, 0];
const RAIL_INK = [255, 255, 255];

const TARGETS = [
  { file: join(root, "src", "app", "icon.png"), size: 256, shape: "circle", fill: 0.8 },
  { file: join(root, "public", "brand", "classy-v-circle.png"), size: 512, shape: "circle", fill: 0.8 },
  // iOS renders transparency as black and applies its own mask, so ship a full bleed square.
  { file: join(root, "src", "app", "apple-icon.png"), size: 180, shape: "square", fill: 0.76 },
];

/** Trimmed, transparent, light-ink marks: the storefront rail and the boot splash. */
const STAMPS = [
  { source: RAIL_SOURCE, file: join(root, "public", "brand", "classy-v-rail.png"), width: 520 },
  // The splash scales the wordmark across the viewport, so it is stamped wider.
  { source: SPLASH_SOURCE, file: join(root, "public", "brand", "classy-v-splash.png"), width: 960 },
];

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("Source is not a PNG file.");

  const chunks = [];
  let header;
  let offset = 8;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      chunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset += length + 12;
  }

  const channels = header && CHANNELS[header.colorType];
  if (!header || !channels || header.depth !== 8 || header.interlace !== 0) {
    throw new Error("Only non-interlaced 8-bit PNG sources are supported.");
  }

  const { width, height } = header;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(chunks));
  const pixels = new Uint8Array(stride * height);
  let cursor = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const line = raw.subarray(cursor, cursor + stride);
    cursor += stride;
    const row = y * stride;
    const previous = row - stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const up = y > 0 ? pixels[previous + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[previous + x - channels] : 0;
      let value = line[x];

      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const dLeft = Math.abs(estimate - left);
        const dUp = Math.abs(estimate - up);
        const dUpLeft = Math.abs(estimate - upLeft);
        value += dLeft <= dUp && dLeft <= dUpLeft ? left : dUp <= dUpLeft ? up : upLeft;
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG scanline filter: ${filter}`);
      }

      pixels[row + x] = value & 0xff;
    }
  }

  return { width, height, channels, pixels };
}

/** Ink coverage of one source pixel: 1 = fully opaque black, 0 = paper or transparent. */
function inkAt(image, x, y) {
  const { width, height, channels, pixels } = image;
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;

  const index = (y * width + x) * channels;
  let luminance;
  let alpha = 255;

  if (channels <= 2) {
    luminance = pixels[index];
    if (channels === 2) alpha = pixels[index + 1];
  } else {
    luminance = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
    if (channels === 4) alpha = pixels[index + 3];
  }

  const coverage = image.lightInk ? luminance / 255 : 1 - luminance / 255;
  return (alpha / 255) * coverage;
}

function inkBounds(image, threshold = 0.35) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (inkAt(image, x, y) < threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return { x: 0, y: 0, width: image.width, height: image.height };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Average ink over the source box mapped to one output pixel (box downsampling). */
function sampleInk(image, x0, y0, x1, y1) {
  const startX = Math.floor(x0);
  const startY = Math.floor(y0);
  const endX = Math.max(Math.ceil(x1), startX + 1);
  const endY = Math.max(Math.ceil(y1), startY + 1);
  let total = 0;
  let count = 0;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      total += inkAt(image, x, y);
      count += 1;
    }
  }

  return count === 0 ? 0 : total / count;
}

/** Anti-aliased disc coverage via a 4x4 subpixel grid. */
function discCoverage(x, y, size) {
  const center = size / 2;
  const radius = center;
  let hits = 0;

  for (let sy = 0; sy < 4; sy += 1) {
    for (let sx = 0; sx < 4; sx += 1) {
      const dx = x + (sx + 0.5) / 4 - center;
      const dy = y + (sy + 0.5) / 4 - center;
      if (dx * dx + dy * dy <= radius * radius) hits += 1;
    }
  }

  return hits / 16;
}

function renderIcon(image, bounds, { size, shape, fill }) {
  const side = Math.max(bounds.width, bounds.height) / fill;
  const originX = bounds.x + bounds.width / 2 - side / 2;
  const originY = bounds.y + bounds.height / 2 - side / 2;
  const scale = side / size;
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const ink = sampleInk(
        image,
        originX + x * scale,
        originY + y * scale,
        originX + (x + 1) * scale,
        originY + (y + 1) * scale
      );
      const mask = shape === "circle" ? discCoverage(x, y, size) : 1;
      const index = (y * size + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        rgba[index + channel] = Math.round(
          DISC[channel] + (ICON_INK[channel] - DISC[channel]) * ink
        );
      }
      rgba[index + 3] = Math.round(mask * 255);
    }
  }

  return rgba;
}

/** Ink becomes opaque light pixels, paper becomes fully transparent. */
function renderInkStamp(image, bounds, { width }) {
  const pad = Math.round(bounds.width * 0.02);
  const sourceWidth = bounds.width + pad * 2;
  const sourceHeight = bounds.height + pad * 2;
  const height = Math.max(1, Math.round((width * sourceHeight) / sourceWidth));
  const scale = sourceWidth / width;
  const originX = bounds.x - pad;
  const originY = bounds.y - pad;
  const rgba = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const ink = sampleInk(
        image,
        originX + x * scale,
        originY + y * scale,
        originX + (x + 1) * scale,
        originY + (y + 1) * scale
      );
      const index = (y * width + x) * 4;
      rgba[index] = RAIL_INK[0];
      rgba[index + 1] = RAIL_INK[1];
      rgba[index + 2] = RAIL_INK[2];
      rgba[index + 3] = Math.round(Math.min(1, ink * 1.35) * 255);
    }
  }

  return { width, height, rgba };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    Buffer.from(rgba.subarray(y * stride, (y + 1) * stride)).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function loadMark({ file, lightInk = false }) {
  const image = decodePng(await readFile(file));
  return { ...image, lightInk };
}

async function main() {
  const iconMark = await loadMark(ICON_SOURCE);
  const iconBounds = inkBounds(iconMark);

  for (const target of TARGETS) {
    await mkdir(dirname(target.file), { recursive: true });
    await writeFile(
      target.file,
      encodePng(target.size, target.size, renderIcon(iconMark, iconBounds, target))
    );
    console.log(`${target.shape} ${target.size}px -> ${target.file}`);
  }

  for (const target of STAMPS) {
    const mark = await loadMark(target.source);
    const stamp = renderInkStamp(mark, inkBounds(mark), target);
    await mkdir(dirname(target.file), { recursive: true });
    await writeFile(target.file, encodePng(stamp.width, stamp.height, stamp.rgba));
    console.log(`stamp ${stamp.width}x${stamp.height} -> ${target.file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

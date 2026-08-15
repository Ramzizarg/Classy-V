/** Dev helper: print the RGB of a pixel in a PNG screenshot. Usage: node scripts/sample-pixel.mjs file x y */
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const [file, xArg, yArg] = process.argv.slice(2);
const buffer = await readFile(file);
const chunks = [];
let header;
let offset = 8;

while (offset + 8 <= buffer.length) {
  const length = buffer.readUInt32BE(offset);
  const type = buffer.toString("ascii", offset + 4, offset + 8);
  const data = buffer.subarray(offset + 8, offset + 8 + length);
  if (type === "IHDR") header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), colorType: data[9] };
  else if (type === "IDAT") chunks.push(data);
  else if (type === "IEND") break;
  offset += length + 12;
}

const channels = header.colorType === 6 ? 4 : 3;
const stride = header.width * channels;
const raw = inflateSync(Buffer.concat(chunks));
const pixels = new Uint8Array(stride * header.height);
let cursor = 0;

for (let y = 0; y < header.height; y += 1) {
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
    }
    pixels[row + x] = value & 0xff;
  }
}

const index = (Number(yArg) * header.width + Number(xArg)) * channels;
const hex = [0, 1, 2].map((c) => pixels[index + c].toString(16).padStart(2, "0")).join("");
console.log(`#${hex}`);

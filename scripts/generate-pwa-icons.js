#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outputDir = path.resolve(__dirname, '..', 'icons');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function encodePng(width, height, pixels) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(Buffer.from([0]));
    rows.push(pixels.subarray(y * width * 4, (y + 1) * width * 4));
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function createCanvas(size) {
  const pixels = Buffer.alloc(size * size * 4);

  function setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const offset = (y * size + x) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3] ?? 255;
  }

  function fill(color) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) setPixel(x, y, color);
    }
  }

  function rectangle(x, y, width, height, color) {
    for (let py = Math.floor(y); py < Math.ceil(y + height); py += 1) {
      for (let px = Math.floor(x); px < Math.ceil(x + width); px += 1) {
        setPixel(px, py, color);
      }
    }
  }

  function polygon(points, color) {
    const minY = Math.max(0, Math.floor(Math.min(...points.map(point => point[1]))));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(...points.map(point => point[1]))));

    for (let y = minY; y <= maxY; y += 1) {
      const intersections = [];
      for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        if ((current[1] > y) !== (next[1] > y)) {
          intersections.push(
            current[0] + ((y - current[1]) * (next[0] - current[0])) / (next[1] - current[1])
          );
        }
      }
      intersections.sort((a, b) => a - b);
      for (let index = 0; index < intersections.length; index += 2) {
        for (let x = Math.ceil(intersections[index]); x <= Math.floor(intersections[index + 1]); x += 1) {
          setPixel(x, y, color);
        }
      }
    }
  }

  return { pixels, fill, rectangle, polygon };
}

function renderIcon(size, maskable = false) {
  const canvas = createCanvas(size);
  const scale = size / 512;
  const point = (x, y) => [Math.round(x * scale), Math.round(y * scale)];
  const rect = (x, y, width, height, color) => {
    canvas.rectangle(x * scale, y * scale, width * scale, height * scale, color);
  };

  canvas.fill([37, 99, 235, 255]);

  const inset = maskable ? 34 : 0;
  canvas.polygon([
    point(88 + inset, 250),
    point(256, 102 + inset),
    point(424 - inset, 250),
    point(392 - inset / 2, 286),
    point(256, 166 + inset / 2),
    point(120 + inset / 2, 286)
  ], [219, 234, 254, 255]);

  canvas.polygon([
    point(112 + inset / 2, 238),
    point(256, 112 + inset),
    point(400 - inset / 2, 238),
    point(400 - inset / 2, 396 - inset / 2),
    point(360 - inset / 2, 436 - inset / 2),
    point(152 + inset / 2, 436 - inset / 2),
    point(112 + inset / 2, 396 - inset / 2)
  ], [255, 255, 255, 255]);

  rect(216, 304, 80, 132 - inset / 2, [37, 99, 235, 255]);
  rect(332 - inset / 3, 218 + inset / 3, 72, 72, [249, 115, 22, 255]);
  rect(350 - inset / 3, 234 + inset / 3, 36, 8, [255, 255, 255, 255]);
  rect(350 - inset / 3, 250 + inset / 3, 36, 8, [255, 255, 255, 255]);
  rect(350 - inset / 3, 266 + inset / 3, 24, 8, [255, 255, 255, 255]);

  return encodePng(size, size, canvas.pixels);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'icon-192.png'), renderIcon(192));
fs.writeFileSync(path.join(outputDir, 'icon-512.png'), renderIcon(512));
fs.writeFileSync(path.join(outputDir, 'icon-maskable-512.png'), renderIcon(512, true));
fs.writeFileSync(path.join(outputDir, 'apple-touch-icon.png'), renderIcon(180));

console.log('Generated PWA icons in', outputDir);

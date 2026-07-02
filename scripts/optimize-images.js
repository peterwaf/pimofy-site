/**
 * Image optimizer for /assets.
 *
 * Recompresses source JPEGs in place (dimensions unchanged, so existing
 * width/height attributes stay valid) and emits a matching .webp for each.
 * Run with: npm run optimize:images
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const JPEG_QUALITY = 76;
const WEBP_QUALITY = 72;

async function run() {
  const files = fs
    .readdirSync(ASSETS_DIR)
    .filter((f) => /\.jpe?g$/i.test(f));

  let before = 0;
  let after = 0;

  for (const file of files) {
    const src = path.join(ASSETS_DIR, file);
    const webpOut = src.replace(/\.jpe?g$/i, '.webp');
    const original = fs.readFileSync(src);
    before += original.length;

    // Recompress JPEG (mozjpeg) in place at the same dimensions.
    const jpegBuf = await sharp(original)
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    fs.writeFileSync(src, jpegBuf);

    // Emit a WebP sibling.
    const webpBuf = await sharp(original)
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer();
    fs.writeFileSync(webpOut, webpBuf);

    after += jpegBuf.length + webpBuf.length;
    console.log(
      `${file}: ${(original.length / 1024).toFixed(0)}KB -> ` +
        `jpg ${(jpegBuf.length / 1024).toFixed(0)}KB + ` +
        `webp ${(webpBuf.length / 1024).toFixed(0)}KB`
    );
  }

  console.log(
    `\nTotal source: ${(before / 1024 / 1024).toFixed(2)}MB -> ` +
      `${(after / 1024 / 1024).toFixed(2)}MB (jpg+webp)`
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

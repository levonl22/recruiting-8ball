import { CanvasTexture, SRGBColorSpace } from "three";

// Point-down triangle in normalized texture space. The text fitter below uses the
// same numbers so copy never crosses the tapered edges.
export const TRI = { top: 0.08, bottom: 0.94, left: 0.06, right: 0.94, tipX: 0.5 };

const TEXT_TOP = 0.17;
const TEXT_BOTTOM = 0.7;
const WIDTH_SAFETY = 0.8;
const LINE_RATIO = 1.14;

const FONT_STACK = 'Inter, system-ui, -apple-system, sans-serif';

let maxAnisotropy = 1;

export function setTextureQuality(renderer) {
  maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
}

function makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function toTexture(canvas) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

function tracePath(ctx, size) {
  ctx.beginPath();
  ctx.moveTo(TRI.left * size, TRI.top * size);
  ctx.lineTo(TRI.right * size, TRI.top * size);
  ctx.lineTo(TRI.tipX * size, TRI.bottom * size);
  ctx.closePath();
}

export function createTriangleTexture(size = 1024) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");

  tracePath(ctx, size);
  const gradient = ctx.createRadialGradient(
    size * 0.5,
    size * 0.33,
    size * 0.02,
    size * 0.5,
    size * 0.4,
    size * 0.62
  );
  gradient.addColorStop(0, "#d8ebfb");
  gradient.addColorStop(0.28, "#a9d0ef");
  gradient.addColorStop(0.55, "#5f9bd6");
  gradient.addColorStop(0.8, "#2a639f");
  gradient.addColorStop(1, "#123d6d");
  ctx.fillStyle = gradient;
  ctx.fill();

  return toTexture(canvas);
}

function setFont(ctx, px) {
  ctx.font = `700 ${px}px ${FONT_STACK}`;
  if ("letterSpacing" in ctx) {
    // Heavy tracking makes thin glyphs like ' disappear after downscale + bloom.
    ctx.letterSpacing = `${Math.max(0, px * 0.02)}px`;
  }
}

function maxWidthAt(yNorm) {
  const t = Math.min(
    1,
    Math.max(0, (yNorm - TRI.top) / (TRI.bottom - TRI.top))
  );
  const left = TRI.left + t * (TRI.tipX - TRI.left);
  const right = TRI.right + t * (TRI.tipX - TRI.right);
  return (right - left) * WIDTH_SAFETY;
}

function tryWrap(ctx, words, px, size) {
  setFont(ctx, px);
  const lineHeight = px * LINE_RATIO;
  const topPx = TEXT_TOP * size;
  const bottomPx = TEXT_BOTTOM * size;
  const lines = [];
  let index = 0;

  while (index < words.length) {
    const centerY = topPx + (lines.length + 0.5) * lineHeight;
    if (centerY + lineHeight * 0.5 > bottomPx) return null;

    const limit = maxWidthAt(centerY / size) * size;
    let line = words[index];
    if (ctx.measureText(line).width > limit) return null;
    index += 1;

    while (index < words.length) {
      const candidate = `${line} ${words[index]}`;
      if (ctx.measureText(candidate).width > limit) break;
      line = candidate;
      index += 1;
    }

    lines.push({ text: line, y: centerY });
  }

  return lines;
}

export function createFortuneTexture(text, size = 1024) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const words = text.replace(/\./g, "").toUpperCase().trim().split(/\s+/);

  let lines = null;
  let px = size * 0.05;

  for (let candidate = size * 0.105; candidate >= size * 0.042; candidate -= size * 0.002) {
    const wrapped = tryWrap(ctx, words, candidate, size);
    if (wrapped) {
      lines = wrapped;
      px = candidate;
      break;
    }
  }

  if (!lines) {
    lines = [{ text: words.join(" "), y: size * 0.3 }];
    px = size * 0.042;
  }

  setFont(ctx, px);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Dark ink on the pale die: white text disappears once bloom lifts the center.
  ctx.fillStyle = "#082a52";
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  for (const line of lines) {
    ctx.fillText(line.text, TRI.tipX * size, line.y);
  }

  return toTexture(canvas);
}

export function createMarkTexture(mark = "?", size = 1024) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");

  ctx.font = `600 ${size * 0.3}px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#0d3a6b";
  ctx.fillText(mark, TRI.tipX * size, size * 0.4);

  return toTexture(canvas);
}

export function createGlowTexture(size = 512) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.18, "rgba(200, 228, 255, 0.75)");
  gradient.addColorStop(0.45, "rgba(120, 180, 255, 0.28)");
  gradient.addColorStop(1, "rgba(60, 130, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return toTexture(canvas);
}

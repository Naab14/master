/* pdf.js — MiniPDF: dependency-free client-side PDF writer (text, rects, lines).
   Produces ASCII-only PDF 1.4 documents so byte offsets stay trivial and the
   export works fully offline. Ported unchanged from ManageClip, exposed as an
   ES module instead of window.MiniPDF. */

export const W = 595.28; // A4 portrait, points
export const H = 841.89;

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
    .map(v => +v.toFixed(3));
}

// Keep output pure ASCII so string length === byte length for xref offsets.
function esc(s) {
  return String(s)
    .replace(/[\\()]/g, c => '\\' + c)
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, '?');
}

export function doc() {
  const pages = [];
  let cur;

  function addPage() {
    cur = { stream: [] };
    pages.push(cur);
  }
  addPage();

  function fill(hex) {
    const [r, g, b] = hexToRgb(hex);
    cur.stream.push(`${r} ${g} ${b} rg`);
  }

  /* y is measured from the top of the page for all helpers. */
  function text(x, y, str, opts) {
    opts = opts || {};
    fill(opts.color || '#000000');
    const font = opts.bold ? 'F2' : 'F1';
    const size = opts.size || 10;
    cur.stream.push(`BT /${font} ${size} Tf ${x} ${(H - y).toFixed(2)} Td (${esc(str)}) Tj ET`);
  }

  function rect(x, y, w, h, color) {
    fill(color);
    cur.stream.push(`${x} ${(H - y - h).toFixed(2)} ${w} ${h} re f`);
  }

  function line(x1, y1, x2, y2, color, width) {
    const [r, g, b] = hexToRgb(color);
    cur.stream.push(`${r} ${g} ${b} RG ${width || 1} w ${x1} ${(H - y1).toFixed(2)} m ${x2} ${(H - y2).toFixed(2)} l S`);
  }

  function output() {
    const objs = [];
    const pageObjNums = pages.map((_, i) => 5 + i * 2);
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = `<< /Type /Pages /Kids [${pageObjNums.map(n => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
    pages.forEach((p, i) => {
      const n = 5 + i * 2;
      const stream = p.stream.join('\n');
      objs[n] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
        '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ' +
        `/Contents ${n + 1} 0 R >>`;
      objs[n + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    let out = '%PDF-1.4\n';
    const offsets = [];
    for (let i = 1; i < objs.length; i++) {
      offsets[i] = out.length;
      out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
    }
    const xref = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objs.length; i++) {
      out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return out;
  }

  function download(filename) {
    const blob = new Blob([output()], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return { addPage, text, rect, line, output, download, W, H };
}

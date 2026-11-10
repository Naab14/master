/* Small CSV reader for imports: commas or semicolons (Swedish Excel),
 * quoted fields, a header row. */
export function parseCsv(text) {
  let src = String(text);
  if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1); // byte-order mark from Excel
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';
  const table = [];
  let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; } else if (ch === '"') quoted = false; else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(c => c.trim() !== '')) table.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some(c => c.trim() !== '')) table.push(row);
  const headers = (table.shift() || []).map(h => h.trim());
  return { headers, rows: table.map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}

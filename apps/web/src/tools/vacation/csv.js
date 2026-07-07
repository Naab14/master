import { PROCESSES } from './data';

const UTF8_BOM = '\uFEFF';

const SWEDISH_HEADER_MAP = {
  'namn': 'name',
  'skift': 'shift',
  'certifieringar': 'certifications',
};

const ENGLISH_HEADERS = new Set(['name', 'shift', 'certifications']);

function isCommentLine(line) {
  return line.trimStart().startsWith('#');
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

function suggestCert(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let best = null;
  let bestDist = Infinity;
  for (const p of PROCESSES) {
    const d = levenshtein(trimmed, p);
    if (d < bestDist && d <= 2) { bestDist = d; best = p; }
  }
  return best;
}

function matchCertCaseInsensitive(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return PROCESSES.find(p => p.toLowerCase() === lower) || null;
}

function normalizeHeader(raw) {
  const lower = raw.trim().toLowerCase();
  if (SWEDISH_HEADER_MAP[lower]) return SWEDISH_HEADER_MAP[lower];
  if (ENGLISH_HEADERS.has(lower)) return lower;
  return lower;
}

/**
 * Parse CSV text into operator objects. Accepts Swedish (Namn/Skift/Certifieringar)
 * or English (Name/Shift/Certifications) headers. Lines starting with `#` are
 * treated as comments and skipped. Returns `{ operators, error, warnings }`
 * where warnings carry per-row hints (unknown certs with fuzzy suggestions).
 */
export function parseCSV(text) {
  const stripped = text.replace(/^\uFEFF/, '');
  const allLines = stripped.split(/\r?\n/);
  const dataLines = [];
  const originalLineNumbers = [];
  allLines.forEach((line, idx) => {
    if (!line.trim() || isCommentLine(line)) return;
    dataLines.push(line);
    originalLineNumbers.push(idx + 1);
  });

  if (dataLines.length < 2) {
    return { operators: [], error: 'CSV must have a header row and at least one data row', warnings: [] };
  }

  const header = splitCSVLine(dataLines[0]).map(normalizeHeader);
  const nameIdx = header.indexOf('name');
  const shiftIdx = header.indexOf('shift');
  const certIdx = header.indexOf('certifications');

  if (nameIdx === -1) {
    return { operators: [], error: 'Missing "Namn" / "Name" column', warnings: [] };
  }

  const operators = [];
  const warnings = [];
  for (let i = 1; i < dataLines.length; i++) {
    const rowNum = originalLineNumbers[i];
    const cols = splitCSVLine(dataLines[i]);
    const name = cols[nameIdx]?.trim();
    if (!name) continue;
    const shift = shiftIdx !== -1 ? (cols[shiftIdx]?.trim() || 'S1') : 'S1';
    const rawCerts = certIdx !== -1 ? (cols[certIdx]?.trim() || '') : '';
    const certTokens = rawCerts.split(';').map(c => c.trim()).filter(Boolean);
    const certifications = [];
    for (const token of certTokens) {
      const matched = matchCertCaseInsensitive(token);
      if (matched) {
        certifications.push(matched);
      } else {
        const suggestion = suggestCert(token);
        warnings.push(
          suggestion
            ? `Rad ${rowNum}: Okänd certifiering "${token}" — menade du "${suggestion}"?`
            : `Rad ${rowNum}: Okänd certifiering "${token}"`,
        );
      }
    }
    operators.push({ name, shift: shift.toUpperCase(), certifications });
  }
  return { operators, error: null, warnings };
}

/**
 * Merge imported operators with existing list. Match by name (case-insensitive).
 */
export function mergeOperators(existing, imported) {
  let added = 0, updated = 0;
  const result = [...existing];
  for (const op of imported) {
    const match = result.find(e => e.name.toLowerCase() === op.name.toLowerCase());
    if (match) {
      match.shift = op.shift;
      match.certifications = op.certifications;
      updated++;
    } else {
      result.push({
        id: 'op_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: op.name,
        shift: op.shift,
        active: true,
        certifications: op.certifications,
      });
      added++;
    }
  }
  return { operators: result, added, updated };
}

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function todayIso() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function buildHeaderComments(title) {
  return [
    `# ${title}`,
    `# Genererad: ${todayIso()}`,
    '# Format: Namn, Skift (S1/S2), Certifieringar (semikolon-separerade)',
    `# Tillgängliga certifieringar: ${PROCESSES.join('; ')}`,
    '',
  ];
}

/**
 * Serialize the current operator list to CSV (Swedish headers, `#` comment
 * preamble). Returns the string including a UTF-8 BOM so Excel opens it
 * correctly without encoding issues.
 */
export function exportOperatorsCSV(operators) {
  const rows = [
    ...buildHeaderComments('Semester Planner — Personalexport'),
    'Namn,Skift,Certifieringar',
    ...operators.map(op =>
      [csvEscape(op.name), csvEscape(op.shift), csvEscape((op.certifications || []).join(';'))].join(','),
    ),
  ];
  return UTF8_BOM + rows.join('\n') + '\n';
}

function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Download the current operator list as a Swedish CSV file.
 * Filename: `personal-YYYY-MM-DD.csv`.
 */
export function downloadOperatorsCSV(operators) {
  triggerDownload(exportOperatorsCSV(operators), `personal-${todayIso()}.csv`);
}

/**
 * Download a CSV template with `#` comments listing valid certifications and
 * three example rows (full certs, partial certs, no certs).
 */
export function downloadCSVTemplate() {
  const rows = [
    ...buildHeaderComments('Semester Planner — Personalmall'),
    'Namn,Skift,Certifieringar',
    `Anna Lindgren,S1,${PROCESSES.join(';')}`,
    'Erik Holm,S1,Kapselresaren;Etikettering',
    'Klara Dahl,S2,',
  ];
  triggerDownload(UTF8_BOM + rows.join('\n') + '\n', `personal-mall-${todayIso()}.csv`);
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

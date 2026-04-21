/**
 * JSnap JSON -> Markdown renderer.
 *
 * Pure function. Accepts a JSnap extraction document (either Raw-mode or
 * LLM-mode output) and emits a readable Markdown representation. Used by
 * the popup's format toggle and by the download pipeline.
 *
 * Stable under schemaVersion "2.1". Defensive against unknown block types.
 */

export function jsonToMarkdown(doc) {
  if (!doc || typeof doc !== 'object') return '';
  const lines = [];

  if (doc.title) lines.push(`# ${doc.title}`);
  if (doc.description) lines.push(`> ${doc.description}`);
  if (doc.url) lines.push(`[${doc.url}](${doc.url})`);
  if (lines.length) lines.push('');

  if (Array.isArray(doc.sections)) {
    for (const section of doc.sections) renderSection(section, lines, 2);
  } else if (typeof doc === 'object') {
    lines.push('```json');
    lines.push(JSON.stringify(doc, null, 2));
    lines.push('```');
  }

  return lines.join('\n').trim() + '\n';
}

function renderSection(section, lines, baseLevel) {
  if (!section) return;
  const level = Math.min(6, Math.max(1, baseLevel + (section.level ?? 1) - 1));
  if (section.heading) {
    lines.push(`${'#'.repeat(level)} ${section.heading}`);
    lines.push('');
  }

  if (Array.isArray(section.blocks)) {
    for (const block of section.blocks) renderBlock(block, lines);
  }

  if (Array.isArray(section.subsections)) {
    for (const sub of section.subsections) renderSection(sub, lines, level + 1);
  }

  // LLM-mode shape: section may have `content`, `lists`, `tables`, `code` directly.
  if (typeof section.content === 'string' && section.content.trim()) {
    lines.push(section.content.trim());
    lines.push('');
  }
  if (Array.isArray(section.lists)) {
    for (const list of section.lists)
      renderList({ type: 'list', ordered: false, items: list }, lines);
  }
  if (Array.isArray(section.tables)) {
    for (const tbl of section.tables) renderStructuredTable(tbl, lines);
  }
  if (Array.isArray(section.code)) {
    for (const txt of section.code) renderBlock({ type: 'code', text: String(txt ?? '') }, lines);
  }
}

function renderBlock(block, lines) {
  if (!block || typeof block !== 'object') return;
  switch (block.type) {
    case 'paragraph':
      if (block.text) {
        lines.push(block.text);
        lines.push('');
      }
      return;
    case 'list':
      renderList(block, lines);
      return;
    case 'table':
      renderTable(block, lines);
      return;
    case 'code': {
      const lang = block.language ?? '';
      lines.push('```' + lang);
      lines.push((block.text ?? '').replace(/```/g, '``\u200b`'));
      lines.push('```');
      lines.push('');
      return;
    }
    case 'quote':
      if (block.text) {
        for (const line of block.text.split('\n')) lines.push(`> ${line}`);
        lines.push('');
      }
      return;
    case 'image': {
      const alt = block.alt ?? '';
      const src = block.src ?? '';
      if (src) {
        lines.push(`![${alt}](${src})`);
        if (block.caption) lines.push(`*${block.caption}*`);
        lines.push('');
      }
      return;
    }
    default:
      return;
  }
}

function renderList(block, lines) {
  const marker = (i) => (block.ordered ? `${i + 1}.` : '-');
  (block.items ?? []).forEach((item, i) => lines.push(`${marker(i)} ${item}`));
  if (block.items?.length) lines.push('');
}

function renderTable(block, lines) {
  const headers = block.headers ?? [];
  const rows = block.rows ?? [];
  if (!headers.length && !rows.length) return;
  const cols = headers.length || (rows[0]?.length ?? 0);
  const headerLine = headers.length ? headers : Array.from({ length: cols }, () => '');
  lines.push(`| ${headerLine.map(esc).join(' | ')} |`);
  lines.push(`| ${Array.from({ length: cols }, () => '---').join(' | ')} |`);
  for (const row of rows) {
    const padded = Array.from({ length: cols }, (_, i) => esc(row[i] ?? ''));
    lines.push(`| ${padded.join(' | ')} |`);
  }
  lines.push('');
}

function renderStructuredTable(rows, lines) {
  if (!Array.isArray(rows) || !rows.length) return;
  const headers = Array.from(
    rows.reduce((set, row) => {
      if (row && typeof row === 'object') Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  if (!headers.length) return;
  lines.push(`| ${headers.map(esc).join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    const cells = headers.map((h) => esc(row?.[h] ?? ''));
    lines.push(`| ${cells.join(' | ')} |`);
  }
  lines.push('');
}

function esc(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, ' ');
}

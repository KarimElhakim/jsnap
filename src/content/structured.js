/**
 * Deterministic DOM → structured JSON extractor.
 *
 * Walks the sanitized document in document order and emits a typed tree of
 * sections and content blocks. No LLM, no network, no heuristics beyond DOM
 * semantics. Runs in the content script in ~100ms for a typical page.
 *
 * Output schema (stable, versioned via EXTRACTOR_VERSION):
 *
 *   {
 *     title, url, description, language,
 *     sections: Section[],
 *     __meta: { mode, extractorVersion, extractedAt, stats }
 *   }
 *
 *   Section = {
 *     heading: string | null,
 *     level: 0..6,
 *     blocks: Block[],
 *     subsections: Section[]
 *   }
 *
 *   Block =
 *     | { type: 'paragraph', text }
 *     | { type: 'list', ordered, items: string[] }
 *     | { type: 'table', headers: string[] | null, rows: string[][] }
 *     | { type: 'code', text, language: string | null }
 *     | { type: 'quote', text }
 *     | { type: 'image', src, alt, caption }
 *
 * The schema is designed so downstream tools can consume the JSON directly
 * without any cleanup or post-processing.
 */

import { sanitize as runSanitizePass } from './sanitizer.js';
import { splitPreText } from './pre-splitter.js';

export const EXTRACTOR_VERSION = '2.0.0';

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const BLOCK_TAGS = new Set(['p', 'ul', 'ol', 'table', 'pre', 'blockquote', 'figure', 'img']);
const CONTAINER_TAGS = new Set(['div', 'section', 'article', 'main', 'span']);

export function extractStructured(doc) {
  const started = performance.now?.() ?? Date.now();

  const clone = prepareDocumentClone(doc);
  const root = findContentRoot(clone);

  let sections = walkIntoSections(root);

  // Fallback for <pre>-heavy pages (GameFAQs-style walkthroughs): if a single
  // <pre> block dominates the output, promote its text-based headings into
  // real sections via ASCII pattern detection.
  sections = maybePromotePreSections(sections);

  const stats = summarise(sections, performance.now?.() ?? Date.now(), started);

  return {
    title: (doc.title ?? '').trim(),
    url: doc.location?.href ?? '',
    description:
      doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? null,
    language: doc.documentElement?.lang?.trim() || null,
    sections,
    __meta: {
      mode: 'raw',
      extractorVersion: EXTRACTOR_VERSION,
      extractedAt: new Date().toISOString(),
      stats,
    },
  };
}

function prepareDocumentClone(doc) {
  // Reuse the sanitizer's stripping logic without its markdown-text output.
  runSanitizePass(doc);
  const clone = doc.cloneNode(true);

  const STRIP = [
    'script',
    'style',
    'noscript',
    'svg',
    'template',
    'iframe',
    'nav',
    'aside',
    'footer',
    'header',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    '[hidden]',
    '[aria-hidden="true"]',
  ];
  for (const selector of STRIP) {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  }
  clone.querySelectorAll('*').forEach((el) => {
    const style = el.getAttribute?.('style');
    if (style && /display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) el.remove();
  });
  return clone;
}

function findContentRoot(clone) {
  return (
    clone.querySelector('main') ??
    clone.querySelector('article') ??
    clone.querySelector('[role="main"]') ??
    clone.body ??
    clone
  );
}

function walkIntoSections(root) {
  const rootSection = { heading: null, level: 0, blocks: [], subsections: [] };
  const stack = [rootSection];

  for (const node of iterateBlocks(root)) {
    if (HEADING_TAGS.has(node.tagName.toLowerCase())) {
      const level = Number(node.tagName[1]);
      const heading = node.textContent.trim();
      if (!heading) continue;
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      const next = { heading, level, blocks: [], subsections: [] };
      stack[stack.length - 1].subsections.push(next);
      stack.push(next);
    } else {
      const block = toBlock(node);
      if (block) stack[stack.length - 1].blocks.push(block);
    }
  }

  if (rootSection.subsections.length === 0) {
    return [{ heading: null, level: 0, blocks: rootSection.blocks, subsections: [] }];
  }
  if (rootSection.blocks.length === 0) return rootSection.subsections;
  return [
    { heading: null, level: 0, blocks: rootSection.blocks, subsections: [] },
    ...rootSection.subsections,
  ];
}

function* iterateBlocks(root) {
  function* visit(node) {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (HEADING_TAGS.has(tag) || BLOCK_TAGS.has(tag)) {
      yield node;
      return;
    }
    if (CONTAINER_TAGS.has(tag) || !BLOCK_TAGS.has(tag)) {
      for (const child of node.children) yield* visit(child);
    }
  }
  yield* visit(root);
}

function toBlock(node) {
  const tag = node.tagName.toLowerCase();

  if (tag === 'p') {
    const text = collapseWhitespace(node.textContent);
    return text ? { type: 'paragraph', text } : null;
  }
  if (tag === 'ul' || tag === 'ol') {
    const items = [...node.querySelectorAll(':scope > li')]
      .map((li) => collapseWhitespace(li.textContent))
      .filter(Boolean);
    return items.length ? { type: 'list', ordered: tag === 'ol', items } : null;
  }
  if (tag === 'table') {
    const headers = [...node.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    const bodyRows = [...node.querySelectorAll('tbody tr')];
    const fallbackRows = bodyRows.length ? bodyRows : [...node.querySelectorAll('tr')];
    const rows = fallbackRows
      .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()))
      .filter((r) => r.length);
    if (!headers.length && !rows.length) return null;
    return { type: 'table', headers: headers.length ? headers : null, rows };
  }
  if (tag === 'pre') {
    const text = node.textContent;
    const langMatch = node.querySelector('code')?.className?.match(/language-([\w-]+)/);
    return text.trim() ? { type: 'code', text, language: langMatch?.[1] ?? null } : null;
  }
  if (tag === 'blockquote') {
    const text = collapseWhitespace(node.textContent);
    return text ? { type: 'quote', text } : null;
  }
  if (tag === 'img') {
    const src = node.getAttribute('src');
    if (!src) return null;
    return { type: 'image', src, alt: node.getAttribute('alt') || null, caption: null };
  }
  if (tag === 'figure') {
    const img = node.querySelector('img');
    if (!img?.getAttribute('src')) return null;
    const cap = node.querySelector('figcaption')?.textContent?.trim();
    return {
      type: 'image',
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt') || null,
      caption: cap || null,
    };
  }
  return null;
}

function maybePromotePreSections(sections) {
  // Find a section whose only meaningful content is one big code block.
  const promoted = [];
  for (const section of sections) {
    if (
      section.subsections.length === 0 &&
      section.blocks.length === 1 &&
      section.blocks[0].type === 'code' &&
      section.blocks[0].text.length > 1000
    ) {
      const synthesized = splitPreText(section.blocks[0].text);
      if (synthesized.length >= 2) {
        promoted.push({
          heading: section.heading,
          level: section.level,
          blocks: [],
          subsections: synthesized,
        });
        continue;
      }
    }
    promoted.push({
      ...section,
      subsections: maybePromotePreSections(section.subsections),
    });
  }
  return promoted;
}

function collapseWhitespace(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function summarise(sections, endedAt, startedAt) {
  let sectionCount = 0;
  let blockCount = 0;
  let characters = 0;
  function walk(section) {
    sectionCount += 1;
    for (const block of section.blocks) {
      blockCount += 1;
      characters += measureBlock(block);
    }
    for (const sub of section.subsections) walk(sub);
  }
  for (const s of sections) walk(s);
  return {
    sections: sectionCount,
    blocks: blockCount,
    characters,
    elapsedMs: Math.round(endedAt - startedAt),
  };
}

function measureBlock(block) {
  if (block.type === 'paragraph' || block.type === 'quote' || block.type === 'code')
    return block.text.length;
  if (block.type === 'list') return block.items.join(' ').length;
  if (block.type === 'table') {
    const header = (block.headers ?? []).join(' ').length;
    const body = block.rows.flat().join(' ').length;
    return header + body;
  }
  return 0;
}

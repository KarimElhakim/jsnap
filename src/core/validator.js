/**
 * JSON parser with a small repair pass for common LLM output quirks.
 *
 * Order of operations:
 * 1. Strict JSON.parse.
 * 2. If that fails, repair: strip code fences, strip leading/trailing prose,
 *    trim trailing commas, balance truncated braces/brackets where safe.
 * 3. Parse again. Throw SchemaError if still invalid.
 */

import { ERROR_CODES, SchemaError } from './errors.js';

const FENCE_RE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

export function validateAndParse(raw) {
  if (raw == null || typeof raw !== 'string') {
    throw new SchemaError(ERROR_CODES.SCHEMA_INVALID, 'Response was not a string');
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new SchemaError(ERROR_CODES.SCHEMA_INVALID, 'Response was empty');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to repair
  }

  const repaired = repair(trimmed);
  try {
    return JSON.parse(repaired);
  } catch (err) {
    throw new SchemaError(ERROR_CODES.SCHEMA_UNREPAIRABLE, 'Model output was not valid JSON', {
      cause: err,
      context: { snippet: trimmed.slice(0, 200) },
    });
  }
}

function repair(text) {
  let t = text;

  const fenced = t.match(FENCE_RE);
  if (fenced) t = fenced[1].trim();

  t = sliceToOutermostJson(t);
  t = stripTrailingCommas(t);
  t = balanceBrackets(t);

  return t;
}

function sliceToOutermostJson(text) {
  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);

  if (start === -1) return text;

  const open = text[start];
  const close = open === '{' ? '}' : ']';
  const lastClose = text.lastIndexOf(close);
  if (lastClose <= start) return text.slice(start);
  return text.slice(start, lastClose + 1);
}

function stripTrailingCommas(text) {
  return text.replace(/,(\s*[}\]])/g, '$1');
}

function balanceBrackets(text) {
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') braces += 1;
    else if (c === '}') braces -= 1;
    else if (c === '[') brackets += 1;
    else if (c === ']') brackets -= 1;
  }

  let out = text;
  if (inString) out += '"';
  while (brackets > 0) {
    out += ']';
    brackets -= 1;
  }
  while (braces > 0) {
    out += '}';
    braces -= 1;
  }
  return out;
}

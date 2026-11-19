// XML text escaping for request building. Characters that XML 1.0 cannot carry are rejected.

// Allowed: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/u;

export function escapeXml(value: string | number | boolean): string {
  const s = String(value);
  if (INVALID_XML_CHARS.test(s)) throw new TypeError('value contains characters not allowed in XML');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** `<name>value</name>`; omitted when value is undefined. */
export function el(name: string, value: string | number | boolean | undefined): string {
  if (value === undefined) return '';
  return `<${name}>${escapeXml(value)}</${name}>`;
}

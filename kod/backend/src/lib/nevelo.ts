// Hungarian definite article for a following word: "az" before a vowel sound, "a" otherwise.
// Numbers and Roman numerals are read aloud: "az I. negyedév" (első), "a II." (második), "az 5." (öt),
// "az 1956-os" (ezerkilencszáz…), "a 2026." (kétezer…).
export function huArticle(word: string): 'a' | 'az' {
  const w = word.trim().replace(/^[[(„"'«]+/, '');
  const roman = /^([IVXLCDM]+)\./.exec(w);
  if (roman) return /^(I|V|L|D|M)$/.test(roman[1]!) ? 'az' : 'a'; // első, ötödik, ötvenedik, ötszázadik, ezredik
  const num = /^(\d+)/.exec(w);
  if (num) {
    const n = num[1]!;
    if (n.startsWith('5')) return 'az';
    if (n.startsWith('1') && (n.length === 1 || n.length === 4 || n.length === 7)) return 'az'; // egy, ezer…, egymillió…
    return 'a';
  }
  return /^[aáeéiíoóöőuúüű]/i.test(w) ? 'az' : 'a';
}

/** "a {x}" / "az {x}" in a template: the article right before a filled value follows that value. */
export function withArticle(article: string, value: string): string {
  const art = huArticle(value);
  return article.charAt(0) === 'A' ? art.charAt(0).toUpperCase() + art.slice(1) : art;
}

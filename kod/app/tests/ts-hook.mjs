// Feloldó horog: kiterjesztés nélküli relatív import → .ts / .tsx / index.ts (csak a tesztekhez).
export async function resolve(spec, ctx, next) {
  // a MINTA-adatok JSON-t importálnak attribútum nélkül (a Metro így kéri): a tesztekben JSON-ként töltjük be
  if (/\.json$/.test(spec) && !ctx.importAttributes?.type) {
    const r = await next(spec, { ...ctx, importAttributes: { ...ctx.importAttributes, type: 'json' } });
    return { ...r, format: 'json', importAttributes: { type: 'json' } };
  }
  try {
    return await next(spec, ctx);
  } catch (e) {
    if (e?.code !== 'ERR_MODULE_NOT_FOUND' || !/^\.{1,2}\//.test(spec)) throw e;
    for (const v of [`${spec}.ts`, `${spec}.tsx`, `${spec}/index.ts`]) {
      try {
        return await next(v, ctx);
      } catch {
        /* a következő */
      }
    }
    throw e;
  }
}

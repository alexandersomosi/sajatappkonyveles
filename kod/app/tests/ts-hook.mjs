// Feloldó horog: kiterjesztés nélküli relatív import → .ts / .tsx / index.ts (csak a tesztekhez).
export async function resolve(spec, ctx, next) {
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

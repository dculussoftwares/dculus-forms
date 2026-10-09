/**
 * Build a `Content-Disposition` header value (RFC 6266) carrying both an ASCII
 * fallback `filename` and a UTF-8 `filename*`, so non-Latin names (Tamil,
 * accented, emoji) survive the download while old clients still get a name.
 */
export const contentDisposition = (type: 'attachment' | 'inline', filename: string): string => {
  const asciiFallback = filename
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
};

/* The date a photograph was TAKEN, from its own EXIF — the strip's sort key since iOS renames every
   upload to a random id. Reads only what it needs: IFD0 → the Exif IFD pointer (0x8769) → the
   DateTimeOriginal tag (0x9003). Never DateTime (0x0132), which is the MODIFIED time and sits first in
   the bytes, so a regex over the buffer would pick it.

   LOCAL WALL-CLOCK, OFFSET IGNORED: every photograph at one wedding shares one time zone, and phones
   write OffsetTimeOriginal while many cameras do not — applying it would shift every camera
   photograph 5h30 against the phones'. Returned as Date.UTC of the wall-clock fields so values compare.

   Every read is bounds-checked; anything malformed is "no date", never an exception — an unreadable
   date must not stop a build that the photograph itself can survive. */
const EXIF_IFD_POINTER = 0x8769;
const DATE_TIME_ORIGINAL = 0x9003;

export function dateTaken(exif) {
  if (!Buffer.isBuffer(exif)) return null;
  const start = exif.subarray(0, 6).toString("latin1") === "Exif\0\0" ? 6 : 0;
  const tiff = exif.subarray(start);
  if (tiff.length < 8) return null;
  const order = tiff.subarray(0, 2).toString("latin1");
  if (order !== "II" && order !== "MM") return null;
  const big = order === "MM";
  const u16 = (at) =>
    at + 2 <= tiff.length
      ? big
        ? tiff.readUInt16BE(at)
        : tiff.readUInt16LE(at)
      : null;
  const u32 = (at) =>
    at + 4 <= tiff.length
      ? big
        ? tiff.readUInt32BE(at)
        : tiff.readUInt32LE(at)
      : null;

  const find = (ifd, tag) => {
    const count = u16(ifd);
    if (count === null) return null;
    for (let i = 0; i < count; i += 1) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === tag) return entry;
    }
    return null;
  };

  const ifd0 = u32(4);
  if (ifd0 === null) return null;
  const pointer = find(ifd0, EXIF_IFD_POINTER);
  if (pointer === null) return null;
  const exifIfd = u32(pointer + 8);
  if (exifIfd === null) return null;
  const entry = find(exifIfd, DATE_TIME_ORIGINAL);
  if (entry === null) return null;
  const length = u32(entry + 4);
  const at = length !== null && length > 4 ? u32(entry + 8) : entry + 8;
  if (at === null || at + 19 > tiff.length) return null;
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(
    tiff.subarray(at, at + 19).toString("latin1"),
  );
  if (match === null) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  /* A camera whose clock was never set writes all zeros, which `Date.UTC` would happily read as
     1899 and sort to the head of the strip. Anything outside a real calendar is "no date". */
  if (
    y < 1900 ||
    mo < 1 ||
    mo > 12 ||
    d < 1 ||
    d > 31 ||
    h > 23 ||
    mi > 59 ||
    s > 60
  ) {
    return null;
  }
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

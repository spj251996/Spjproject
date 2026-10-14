import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { dateTaken } from "./exif-date.mjs";

const withExif = async (exif) =>
  (
    await sharp(
      await sharp({
        create: { width: 4, height: 4, channels: 3, background: "#888" },
      })
        .jpeg()
        .withExif(exif)
        .toBuffer(),
    ).metadata()
  ).exif;

test("the date taken is read as local wall-clock time", async () => {
  const exif = await withExif({
    IFD2: { DateTimeOriginal: "2027:01:09 10:15:30" },
  });
  assert.equal(dateTaken(exif), Date.UTC(2027, 0, 9, 10, 15, 30));
});

test("the offset is ignored, so a phone and an offset-less camera compare on one clock", async () => {
  const phone = await withExif({
    IFD2: {
      DateTimeOriginal: "2027:01:09 10:15:30",
      OffsetTimeOriginal: "+05:30",
    },
  });
  const camera = await withExif({
    IFD2: { DateTimeOriginal: "2027:01:09 10:15:30" },
  });
  assert.equal(dateTaken(phone), dateTaken(camera));
});

test("the modified time is never used as the date taken", async () => {
  /* sharp writes IFD0's DateTime BEFORE the Exif IFD's DateTimeOriginal, so a scan of the bytes
     for the first date would pick the modified time. */
  const exif = await withExif({
    IFD0: { DateTime: "2030:01:01 00:00:00" },
    IFD2: { DateTimeOriginal: "2027:01:09 10:15:30" },
  });
  assert.equal(dateTaken(exif), Date.UTC(2027, 0, 9, 10, 15, 30));
  const modifiedOnly = await withExif({
    IFD0: { DateTime: "2030:01:01 00:00:00" },
  });
  assert.equal(dateTaken(modifiedOnly), null);
});

test("no EXIF, or a buffer too short to hold any, has no date", () => {
  assert.equal(dateTaken(undefined), null);
  assert.equal(dateTaken(Buffer.from("Exif\0\0II")), null);
});

test("a big-endian file is read too", () => {
  /* Hand-built: TIFF "MM", IFD0 with one entry (0x8769 → Exif IFD at 26), Exif IFD with one entry
     (0x9003, ASCII, count 20, value at 44). Offsets are relative to the TIFF header. */
  const tiff = Buffer.alloc(64);
  tiff.write("MM", 0, "latin1");
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8);
  tiff.writeUInt16BE(0x8769, 10);
  tiff.writeUInt16BE(4, 12);
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt32BE(26, 18);
  tiff.writeUInt16BE(1, 26);
  tiff.writeUInt16BE(0x9003, 28);
  tiff.writeUInt16BE(2, 30);
  tiff.writeUInt32BE(20, 32);
  tiff.writeUInt32BE(44, 36);
  tiff.write("2027:01:09 10:15:30\0", 44, "latin1");
  const exif = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  assert.equal(dateTaken(exif), Date.UTC(2027, 0, 9, 10, 15, 30));
});

test("a camera whose clock was never set has no date, so it sorts with the undated", async () => {
  /* Such a camera writes all zeros. Read literally that is 1899-11-30, which would put the
     photograph at the head of the strip, where only two or three of the set are shown. */
  const unset = await withExif({
    IFD2: { DateTimeOriginal: "0000:00:00 00:00:00" },
  });
  assert.equal(dateTaken(unset), null);
  const impossible = await withExif({
    IFD2: { DateTimeOriginal: "2027:13:40 25:61:61" },
  });
  assert.equal(dateTaken(impossible), null);
});

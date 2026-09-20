import fs from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

const ZIP_LOCAL_FILE = 0x04034b50;
const ZIP_CENTRAL_FILE = 0x02014b50;
const ZIP_END = 0x06054b50;
const UTF8_FLAG = 0x0800;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 1000;

interface ZipInputEntry {
  name: string;
  data: Buffer;
  crc: number;
}

interface ParsedEntry {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
  isDirectory: boolean;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipPath(raw: string, allowDirectory = false): string {
  const normalized = raw.replaceAll("\\", "/");
  const isDirectory = allowDirectory && normalized.endsWith("/");
  const parts = normalized.split("/").filter((part) => part.length > 0);
  if (
    !parts.length ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.includes("\0") ||
    parts.some((part) => part === "." || part === "..")
  ) {
    throw new Error("Unsafe ZIP entry path: " + raw);
  }
  return parts.join("/") + (isDirectory ? "/" : "");
}

function dosTimestamp(date = new Date()): { time: number; date: number } {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    time: (hours << 11) | (minutes << 5) | seconds,
    date: ((year - 1980) << 9) | (month << 5) | day,
  };
}

async function collectFiles(
  sourceDir: string,
  rootName: string
): Promise<ZipInputEntry[]> {
  const entries: ZipInputEntry[] = [];
  let totalBytes = 0;

  async function walk(current: string, relative: string): Promise<void> {
    const items = await fs.readdir(current, { withFileTypes: true });
    items.sort((a, b) => a.name.localeCompare(b.name));

    for (const item of items) {
      const absolute = path.join(current, item.name);
      const rel = relative ? path.join(relative, item.name) : item.name;
      if (item.isSymbolicLink()) {
        throw new Error("Job export does not allow symbolic links: " + rel);
      }
      if (item.isDirectory()) {
        await walk(absolute, rel);
        continue;
      }
      if (!item.isFile()) {
        throw new Error("Unsupported Job Pack entry: " + rel);
      }

      const data = await fs.readFile(absolute);
      totalBytes += data.length;
      if (totalBytes > MAX_EXTRACTED_BYTES) {
        throw new Error("Job Pack is too large to export.");
      }
      entries.push({
        name: zipPath(rootName + "/" + rel),
        data,
        crc: crc32(data),
      });
      if (entries.length > MAX_FILES) {
        throw new Error("Job Pack contains too many files to export.");
      }
    }
  }

  await walk(sourceDir, "");
  return entries;
}

export async function writeJobZip(
  sourceDir: string,
  zipFile: string,
  rootName: string
): Promise<void> {
  const safeRoot = zipPath(rootName);
  const entries = await collectFiles(sourceDir, safeRoot);
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  const stamp = dosTimestamp();
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(ZIP_LOCAL_FILE, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(METHOD_STORE, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(entry.crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    parts.push(local, name, entry.data);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(ZIP_CENTRAL_FILE, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(UTF8_FLAG, 8);
    header.writeUInt16LE(METHOD_STORE, 10);
    header.writeUInt16LE(stamp.time, 12);
    header.writeUInt16LE(stamp.date, 14);
    header.writeUInt32LE(entry.crc, 16);
    header.writeUInt32LE(entry.data.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);

    offset += local.length + name.length + entry.data.length;
  }

  const centralOffset = offset;
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(ZIP_END, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  const archive = Buffer.concat([...parts, centralBuffer, end]);
  if (archive.length > MAX_ARCHIVE_BYTES) {
    throw new Error("Exported Job ZIP is too large.");
  }

  await fs.mkdir(path.dirname(zipFile), { recursive: true });
  await fs.writeFile(zipFile, archive);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimum = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= minimum; offset--) {
    if (buffer.readUInt32LE(offset) === ZIP_END) return offset;
  }
  throw new Error("Invalid ZIP: end-of-central-directory record not found.");
}

function parseCentralDirectory(buffer: Buffer): ParsedEntry[] {
  const eocd = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);

  if (totalEntries > MAX_FILES) throw new Error("ZIP contains too many files.");
  if (centralOffset + centralSize > buffer.length) {
    throw new Error("Invalid ZIP central directory bounds.");
  }

  const entries: ParsedEntry[] = [];
  let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_FILE) {
      throw new Error("Invalid ZIP central directory entry.");
    }

    const flags = buffer.readUInt16LE(cursor + 8);
    if (flags & 0x0001) throw new Error("Encrypted ZIP entries are not supported.");

    const method = buffer.readUInt16LE(cursor + 10);
    if (method !== METHOD_STORE && method !== METHOD_DEFLATE) {
      throw new Error("Unsupported ZIP compression method: " + method);
    }

    const crc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) throw new Error("Invalid ZIP entry name bounds.");

    const rawName = buffer.subarray(nameStart, nameEnd).toString("utf8");
    const isDirectory = rawName.replaceAll("\\", "/").endsWith("/");
    const name = zipPath(rawName, isDirectory);

    entries.push({
      name,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      localOffset,
      isDirectory,
    });

    cursor = nameEnd + extraLength + commentLength;
  }
  return entries;
}

export async function extractJobZip(
  zipFile: string,
  destinationDir: string
): Promise<string[]> {
  const stat = await fs.stat(zipFile);
  if (!stat.isFile()) throw new Error("ZIP source is not a file: " + zipFile);
  if (stat.size > MAX_ARCHIVE_BYTES) throw new Error("Job ZIP is too large.");

  const archive = await fs.readFile(zipFile);
  const entries = parseCentralDirectory(archive);
  const extracted: string[] = [];
  let totalUncompressed = 0;

  for (const entry of entries) {
    const target = path.resolve(destinationDir, ...entry.name.split("/").filter(Boolean));
    const root = path.resolve(destinationDir) + path.sep;
    if (target !== path.resolve(destinationDir) && !target.startsWith(root)) {
      throw new Error("ZIP entry escapes destination: " + entry.name);
    }

    if (entry.isDirectory) {
      await fs.mkdir(target, { recursive: true });
      continue;
    }

    if (
      entry.localOffset + 30 > archive.length ||
      archive.readUInt32LE(entry.localOffset) !== ZIP_LOCAL_FILE
    ) {
      throw new Error("Invalid ZIP local file header for " + entry.name);
    }
    const localNameLength = archive.readUInt16LE(entry.localOffset + 26);
    const localExtraLength = archive.readUInt16LE(entry.localOffset + 28);
    const dataStart = entry.localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > archive.length) {
      throw new Error("Invalid ZIP data bounds for " + entry.name);
    }

    const compressed = archive.subarray(dataStart, dataEnd);
    const data =
      entry.method === METHOD_STORE ? Buffer.from(compressed) : inflateRawSync(compressed);

    if (data.length !== entry.uncompressedSize) {
      throw new Error("ZIP size mismatch for " + entry.name);
    }
    if (crc32(data) !== entry.crc) {
      throw new Error("ZIP CRC mismatch for " + entry.name);
    }

    totalUncompressed += data.length;
    if (totalUncompressed > MAX_EXTRACTED_BYTES) {
      throw new Error("Extracted Job Pack exceeds the safety size limit.");
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    extracted.push(target);
  }

  return extracted;
}

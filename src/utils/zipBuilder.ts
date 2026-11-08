export interface ZipEntryFile {
  path: string;
  content: string;
}

// Precompute CRC32 table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Creates a standard uncompressed ZIP archive (Store method) from text files.
 * Works natively in any modern browser without external dependencies.
 */
export function createZipBlob(files: ZipEntryFile[]): Blob {
  const encoder = new TextEncoder();
  const encodedFiles = files.map((file) => {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);
    return {
      nameBytes,
      dataBytes,
      crc,
    };
  });

  let localHeadersSize = 0;
  let centralDirSize = 0;

  for (const f of encodedFiles) {
    localHeadersSize += 30 + f.nameBytes.length + f.dataBytes.length;
    centralDirSize += 46 + f.nameBytes.length;
  }

  const totalSize = localHeadersSize + centralDirSize + 22;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  let offset = 0;
  const localHeaderOffsets: number[] = [];

  // Write Local File Headers + File Data
  for (const f of encodedFiles) {
    localHeaderOffsets.push(offset);

    view.setUint32(offset, 0x04034b50, true); // Local file header signature
    view.setUint16(offset + 4, 20, true); // Version needed to extract (2.0)
    view.setUint16(offset + 6, 0x0800, true); // General purpose bit flag (UTF-8)
    view.setUint16(offset + 8, 0, true); // Compression method (0 = Store)
    view.setUint16(offset + 10, 0x4800, true); // Last mod file time
    view.setUint16(offset + 12, 0x5668, true); // Last mod file date
    view.setUint32(offset + 14, f.crc, true); // CRC-32
    view.setUint32(offset + 18, f.dataBytes.length, true); // Compressed size
    view.setUint32(offset + 22, f.dataBytes.length, true); // Uncompressed size
    view.setUint16(offset + 26, f.nameBytes.length, true); // File name length
    view.setUint16(offset + 28, 0, true); // Extra field length

    offset += 30;
    uint8.set(f.nameBytes, offset);
    offset += f.nameBytes.length;
    uint8.set(f.dataBytes, offset);
    offset += f.dataBytes.length;
  }

  const centralDirStart = offset;

  // Write Central Directory Headers
  for (let i = 0; i < encodedFiles.length; i++) {
    const f = encodedFiles[i];
    const localOffset = localHeaderOffsets[i];

    view.setUint32(offset, 0x02014b50, true); // Central file header signature
    view.setUint16(offset + 4, 20, true); // Version made by
    view.setUint16(offset + 6, 20, true); // Version needed to extract
    view.setUint16(offset + 8, 0x0800, true); // General purpose bit flag (UTF-8)
    view.setUint16(offset + 10, 0, true); // Compression method (0 = Store)
    view.setUint16(offset + 12, 0x4800, true); // Last mod file time
    view.setUint16(offset + 14, 0x5668, true); // Last mod file date
    view.setUint32(offset + 16, f.crc, true); // CRC-32
    view.setUint32(offset + 20, f.dataBytes.length, true); // Compressed size
    view.setUint32(offset + 24, f.dataBytes.length, true); // Uncompressed size
    view.setUint16(offset + 28, f.nameBytes.length, true); // File name length
    view.setUint16(offset + 30, 0, true); // Extra field length
    view.setUint16(offset + 32, 0, true); // File comment length
    view.setUint16(offset + 34, 0, true); // Disk number start
    view.setUint16(offset + 36, 0, true); // Internal file attributes
    view.setUint32(offset + 38, 0, true); // External file attributes
    view.setUint32(offset + 42, localOffset, true); // Relative offset of local header

    offset += 46;
    uint8.set(f.nameBytes, offset);
    offset += f.nameBytes.length;
  }

  const centralDirLength = offset - centralDirStart;

  // Write End of Central Directory Record (EOCD)
  view.setUint32(offset, 0x06054b50, true); // EOCD signature
  view.setUint16(offset + 4, 0, true); // Number of this disk
  view.setUint16(offset + 6, 0, true); // Disk where central directory starts
  view.setUint16(offset + 8, encodedFiles.length, true); // Number of central directory records on this disk
  view.setUint16(offset + 10, encodedFiles.length, true); // Total number of central directory records
  view.setUint32(offset + 12, centralDirLength, true); // Size of central directory
  view.setUint32(offset + 16, centralDirStart, true); // Offset of start of central directory
  view.setUint16(offset + 20, 0, true); // Comment length

  return new Blob([buffer], { type: 'application/zip' });
}

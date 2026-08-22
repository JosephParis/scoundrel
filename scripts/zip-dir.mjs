/**
 * Zip a directory's contents with spec-correct entry names.
 *
 * Exists because Windows PowerShell 5.1's `Compress-Archive` writes entry
 * names with **backslash** separators. The ZIP spec (APPNOTE 4.4.17.1) requires
 * forward slashes, so an archive it produces unpacks on a Unix host into files
 * *named* `assets\index-abc.js` sitting at the root, rather than into an
 * `assets/` directory.
 *
 * The failure that caused is the reason this file exists, and it is worth
 * stating because nothing about it looks like an error: itch.io accepted the
 * upload, unpacked it, reported no problem, and served `index.html` correctly
 * -- that entry is at the root and so has no separator to mangle. Every asset
 * under it 404'd, so the page loaded, the frame opened, and the game silently
 * never started.
 *
 * Deliberately hand-rolled rather than adding a dependency: this writes 35
 * files once per release, and the whole format needed here is three record
 * types. Deflate for everything; the already-compressed audio gains nothing but
 * loses nothing either, and one code path is easier to trust than two.
 *
 * No zip64: entries are well under 4GB and there are tens of them, not tens of
 * thousands. `zipDir` throws rather than silently emitting a broken archive if
 * that ever stops being true.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { join, relative, sep } from 'node:path'

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

/** MS-DOS date/time, which is what the format stores. */
function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, base, out)
    else out.push(relative(base, full))
  }
  return out
}

/**
 * Write every file under `srcDir` into `outFile`, rooted at `srcDir` itself.
 *
 * Entry names are relative to srcDir, so `<srcDir>/index.html` becomes
 * `index.html` -- the archive root, which is where itch.io requires it.
 */
export function zipDir(srcDir, outFile) {
  const files = walk(srcDir)
  if (files.length > 0xffff) throw new Error(`${files.length} entries needs zip64`)

  const locals = []
  const centrals = []
  let offset = 0

  for (const rel of files) {
    // The one line this module exists for. `relative` returns the platform
    // separator; the format mandates '/'.
    const name = rel.split(sep).join('/')
    const nameBuf = Buffer.from(name, 'utf8')

    const body = readFileSync(join(srcDir, rel))
    if (body.length > 0xffffffff) throw new Error(`${name} needs zip64`)
    const deflated = deflateRawSync(body)
    const crc = crc32(body)
    const { time, date } = dosDateTime(statSync(join(srcDir, rel)).mtime)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)      // version needed
    local.writeUInt16LE(0x800, 6)   // UTF-8 names
    local.writeUInt16LE(8, 8)       // deflate
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(deflated.length, 18)
    local.writeUInt32LE(body.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)      // extra field length
    locals.push(local, nameBuf, deflated)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)    // version made by
    central.writeUInt16LE(20, 6)    // version needed
    central.writeUInt16LE(0x800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(deflated.length, 20)
    central.writeUInt32LE(body.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)    // extra
    central.writeUInt16LE(0, 32)    // comment
    central.writeUInt16LE(0, 34)    // disk number start
    central.writeUInt16LE(0, 36)    // internal attributes
    central.writeUInt32LE(0, 38)    // external attributes
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)

    offset += local.length + nameBuf.length + deflated.length
  }

  const centralBuf = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)                 // this disk
  end.writeUInt16LE(0, 6)                 // disk with central directory
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)                // comment length

  writeFileSync(outFile, Buffer.concat([...locals, centralBuf, end]))
  return files.length
}

/**
 * Read back the entry names in an archive's central directory.
 *
 * Used by the spec so the guarantee is checked against the bytes that ship
 * rather than against the intent of the code above.
 */
export function zipEntryNames(file) {
  const b = readFileSync(file)
  const names = []
  for (let i = 0; i < b.length - 4; i++) {
    if (b.readUInt32LE(i) !== 0x02014b50) continue
    const nameLen = b.readUInt16LE(i + 28)
    names.push(b.toString('utf8', i + 46, i + 46 + nameLen))
  }
  return names
}

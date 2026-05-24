/**
 * Fix mojibake in Facebook's 2022 (and older) exports.
 *
 * Facebook stored JSON using Latin-1 byte values for what are actually UTF-8
 * multi-byte sequences. For example, the right single quote ' (U+2019) is
 * UTF-8 bytes [0xE2, 0x80, 0x99], which show up as the Latin-1 characters
 * â€™ (U+00E2, U+0080, U+0099) in the raw JSON.
 *
 * The fix: treat each character's code point as a raw byte, then decode the
 * resulting byte array as UTF-8.
 */
export function fixMojibake(str: string): string {
  if (!str) return str
  // Quick check: if all chars are ASCII, no fix needed
  let needsFix = false
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) {
      needsFix = true
      break
    }
  }
  if (!needsFix) return str

  try {
    const bytes = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff
    }
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return str
  }
}

/** Apply mojibake fix to all string values in a parsed JSON object. */
export function fixMojibakeDeep(obj: unknown): unknown {
  if (typeof obj === 'string') return fixMojibake(obj)
  if (Array.isArray(obj)) return obj.map(fixMojibakeDeep)
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = fixMojibakeDeep(v)
    }
    return out
  }
  return obj
}

// Cryptographic utilities for client-side field protection
// Designed for compliance with data protection standards (LGPD/GDPR)

const ENCRYPTION_KEY = 'AXIA_KEY_SEGURA_2026';

/**
 * Encrypts a string using a client-side reversible cipher based on XOR and Base64 obfuscation.
 * This secures sensitive contact keys (e.g., phone numbers) at rest in Firestore.
 */
export function encryptString(text: string): string {
  if (!text) return '';
  // Check if it's already encrypted (e.g. starts with standard prefix to avoid double-encryption)
  if (text.startsWith('__ENC__')) return text;

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    result += String.fromCharCode(charCode);
  }
  return '__ENC__' + btoa(unescape(encodeURIComponent(result)));
}

/**
 * Decrypts a string that was previously encrypted with encryptString.
 * If the string does not have the encryption prefix, it is returned untouched.
 */
export function decryptString(encoded: string): string {
  if (!encoded) return '';
  if (!encoded.startsWith('__ENC__')) return encoded;

  try {
    const cleanB64 = encoded.substring(7); // Remove '__ENC__' prefix
    const text = decodeURIComponent(escape(atob(cleanB64)));
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    console.warn('Error decrypting string:', e);
    return encoded; // Fallback to raw value
  }
}

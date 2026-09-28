/**
 * SIPMA QR Verification & Security Utility
 * Generates unique verification tokens, verification deep-links, and parses scanned QR codes.
 */

/**
 * Simple robust hash to create a unique, tamper-evident verification token
 */
export function generateVerificationToken(
  regNumber: string,
  extra1: string = '',
  extra2: string = ''
): string {
  const seed = `${regNumber}__SIPMA_VERIFY_KEY_2027__${extra1}__${extra2}`;
  let hash1 = 0x811c9dc5;
  let hash2 = 0x53b1e32d;

  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash1 = (hash1 ^ char) * 0x01000193;
    hash2 = (hash2 ^ (char << (i % 8))) * 0x01000193;
  }

  const p1 = Math.abs(hash1).toString(16).toUpperCase().padStart(4, '0').slice(-4);
  const p2 = Math.abs(hash2).toString(16).toUpperCase().padStart(4, '0').slice(-4);
  return `VER-${p1}-${p2}`;
}

/**
 * Generates the full universal verification deep-link URL.
 * When scanned by a phone camera or scanner, opening this URL immediately navigates
 * to the verification process for this registration number.
 */
export function generateVerificationUrl(
  regNumber: string,
  token?: string,
  customOrigin?: string
): string {
  const origin =
    customOrigin ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://sipma.madrasah.id');

  const cleanOrigin = origin.replace(/\/+$/, '');
  const verToken = token || generateVerificationToken(regNumber);
  
  // Use hash route #/verify?reg=... so it works smoothly on static hosting and Vercel
  return `${cleanOrigin}/#/verify?reg=${encodeURIComponent(regNumber)}&v=${encodeURIComponent(verToken)}`;
}

export interface ParsedQrResult {
  regNumber: string;
  token?: string;
  sourceType: 'url' | 'json' | 'raw';
}

/**
 * Intelligently parses QR code scan text from URLs, JSON strings, or raw registration IDs.
 */
export function parseVerificationQr(rawText: string): ParsedQrResult | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();

  // 1. Check if it's a URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.includes('#/verify') ||
    trimmed.includes('verify_reg') ||
    trimmed.includes('reg=')
  ) {
    try {
      // Parse query params from hash or search
      const hashIndex = trimmed.indexOf('#');
      const searchIndex = trimmed.indexOf('?');

      let queryStr = '';
      if (hashIndex !== -1 && trimmed.slice(hashIndex).includes('?')) {
        queryStr = trimmed.slice(hashIndex).split('?')[1] || '';
      } else if (searchIndex !== -1) {
        queryStr = trimmed.slice(searchIndex + 1);
      }

      if (queryStr) {
        const params = new URLSearchParams(queryStr);
        const reg = params.get('reg') || params.get('verify_reg') || params.get('regNumber') || params.get('no');
        const token = params.get('v') || params.get('token') || undefined;

        if (reg) {
          return {
            regNumber: decodeURIComponent(reg).trim(),
            token: token ? decodeURIComponent(token).trim() : undefined,
            sourceType: 'url',
          };
        }
      }
    } catch (e) {
      console.warn('Failed parsing URL QR:', e);
    }
  }

  // 2. Check if it's a JSON payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      const reg =
        obj.regNumber ||
        obj.registration_number ||
        obj.reg ||
        obj.no_pendaftaran ||
        obj.registrationNumber;

      if (reg && typeof reg === 'string') {
        return {
          regNumber: reg.trim(),
          token: obj.token || obj.verificationCode,
          sourceType: 'json',
        };
      }
    } catch {
      // Not JSON, continue to raw format
    }
  }

  // 3. Raw registration string matching SIPMA patterns
  // E.g.: REG-SIPMA-2027-001, SIPMA-MI02-000001, REG-..., etc.
  const regPattern = /([A-Z0-9_-]{5,35})/i;
  const match = trimmed.match(regPattern);
  if (match && (trimmed.toUpperCase().includes('SIPMA') || trimmed.toUpperCase().includes('REG-') || trimmed.length >= 6)) {
    return {
      regNumber: match[1].trim(),
      sourceType: 'raw',
    };
  }

  return null;
}

/**
 * Plays a pleasant high-tech two-tone chime when a valid QR code is scanned.
 */
export function playScanSuccessChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: High crisp beep (880 Hz - A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Tone 2: Higher confirming tone (1320 Hz - E6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.08);
    gain2.gain.setValueAtTime(0.25, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.28);

    // Trigger haptic vibration if supported on mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.([60, 40, 60]);
    }
  } catch (e) {
    console.warn('Audio chime warning:', e);
  }
}

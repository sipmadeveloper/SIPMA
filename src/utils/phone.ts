/**
 * Utilitas Normalisasi Nomor Telepon & WhatsApp
 * Memastikan setiap nomor HP/WhatsApp yang diinput oleh calon murid maupun admin
 * (baik berawalan 08, +62, 62, maupun 8) secara otomatis tersimpan dengan format '08...'
 * di database lokal, server, maupun spreadsheet Google Sheets (tidak berubah menjadi 62).
 */

export function normalizeIndonesianPhone(phone: string | number | null | undefined): string {
  if (phone === null || phone === undefined) return '';
  let str = String(phone).trim();
  if (!str) return '';

  // Hapus tanda kutip tunggal jika ada di awal (misal format sheet)
  if (str.startsWith("'")) {
    str = str.substring(1).trim();
  }

  // Cek apakah ada tanda '+' di awal
  const hasPlus = str.startsWith('+');
  // Ambil hanya digit
  let digits = str.replace(/[^\d]/g, '');
  if (!digits) return '';

  // Jika berawalan +62 atau 62: ubah 62 menjadi 0
  if (hasPlus && digits.startsWith('62')) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('62')) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('8')) {
    // Jika langsung 8 (misal 81234567890), tambahkan 0 di depan -> 081234567890
    digits = '0' + digits;
  }

  return digits;
}

/**
 * Format nomor telepon khusus saat penulisan ke Google Sheets
 * Menambahkan awalan kutip tunggal (') agar Google Sheets memperlakukannya sebagai teks
 * murni dan mempertahankan awalan 08 tanpa mengonversinya ke angka atau 62.
 */
export function formatPhoneForSheet(phone: string | number | null | undefined): string {
  const norm = normalizeIndonesianPhone(phone);
  if (!norm) return '';
  return norm.startsWith("'") ? norm : `'${norm}`;
}

/**
 * Handler onChange / onBlur untuk input form telepon / WhatsApp
 * Membantu mengonversi input berawalan +62 atau 62 menjadi 08 secara halus
 */
export function formatPhoneOnChange(val: string): string {
  if (!val) return '';
  let cleaned = val.trim();
  if (cleaned.startsWith('+62')) {
    return '0' + cleaned.slice(3).replace(/[^\d]/g, '');
  }
  if (cleaned.startsWith('62') && cleaned.length >= 3) {
    return '0' + cleaned.slice(2).replace(/[^\d]/g, '');
  }
  // Hanya izinkan angka dan tanda plus di awal saat sedang mengetik
  return cleaned.replace(/[^\d+]/g, '');
}

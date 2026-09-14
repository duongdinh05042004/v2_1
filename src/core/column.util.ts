/** Chuyển index cột 0-based thành ký hiệu A1 (0 -> A, 25 -> Z, 26 -> AA). */
export function columnIndexToLetter(index: number): string {
  let n = index + 1;
  let letter = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

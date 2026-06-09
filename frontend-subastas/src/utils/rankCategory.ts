export function rankOf(lvl?: string | number): number {
  if (!lvl && lvl !== 0) return 1;
  const s = String(lvl)
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  const digits = s.match(/\d+/);
  if (digits?.[0]) {
    const num = Number(digits[0]);
    if (num >= 1 && num <= 5) return num;
  }
  if (s.includes('platino') || s.includes('platinum')) return 5;
  if (s.includes('oro')) return 4;
  if (s.includes('plata')) return 3;
  if (s.includes('especial')) return 2;
  if (s.includes('comun') || s.includes('base')) return 1;
  return 1;
}

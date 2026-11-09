import {
  contactoFlagCell,
  contactoHeroFlags,
  contactoHeroGlyphs,
  contactoHeroText,
  contactoHeroTiming,
} from "../data/contacto.ts";

export type FlagPixel = [number, number, number];

export type ContactoHeroState = {
  flagIndex: number;
  cols: number;
  caretOn: boolean;
};

export const flagAssetBase = "/images/contacto/flags/";

export function buildTextDots(
  text = contactoHeroText,
  glyphs = contactoHeroGlyphs,
): { dots: Array<[number, number]>; textWidth: number } {
  const dots: Array<[number, number]> = [];
  let x = 0;
  for (const ch of text) {
    const glyph = glyphs[ch];
    if (!glyph) continue;
    glyph.forEach((row, y) => {
      [...row].forEach((bit, i) => {
        if (bit === "1") dots.push([x + i, y + 1]);
      });
    });
    x += glyph[0]!.length + 1;
  }
  return { dots, textWidth: x - 1 };
}

export function gridColumns(textWidth: number): number {
  return textWidth + contactoFlagCell.gap + contactoFlagCell.width + 2;
}

export function pitchForWidth(width: number, columns: number): number {
  const usable = Math.min(width - 48, 1200);
  return Math.max(4, Math.floor(usable / columns));
}

export function shouldAnimate(
  reduceMotion: boolean,
  staticMode: boolean,
): boolean {
  return !reduceMotion && !staticMode;
}

export function nextFlagIndex(current: number, total: number = contactoHeroFlags.length): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

export function flagSrc(file: string): string {
  return `${flagAssetBase}${file}`;
}

export { contactoHeroTiming, contactoHeroFlags, contactoFlagCell };

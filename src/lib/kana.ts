
const GOJUON: [string, string][] = [
  ["", "あいうえお"],
  ["k", "かきくけこ"],
  ["g", "がぎぐげご"],
  ["s", "さしすせそ"],
  ["z", "ざじずぜぞ"],
  ["t", "たちつてと"],
  ["d", "だぢづでど"],
  ["n", "なにぬねの"],
  ["h", "はひふへほ"],
  ["b", "ばびぶべぼ"],
  ["p", "ぱぴぷぺぽ"],
  ["m", "まみむめも"],
  ["y", "や・ゆ・よ"],
  ["r", "らりるれろ"],
  ["w", "わゐ・ゑを"],
];

const VOWELS = "aiueo";

const vowelOf = new Map<string, string>();
const consonantOf = new Map<string, string>();
for (const [consonant, row] of GOJUON) {
  [...row].forEach((kana, i) => {
    if (kana === "・") return;
    vowelOf.set(kana, VOWELS[i]!);
    consonantOf.set(kana, consonant);
  });
}

const VOICING: [string, string][] = [["k", "g"], ["s", "z"], ["t", "d"], ["h", "b"], ["h", "p"], ["b", "p"]];

function rowKana(consonant: string, vowel: string): string | undefined {
  const row = GOJUON.find(([c]) => c === consonant)?.[1];
  const kana = row ? [...row][VOWELS.indexOf(vowel)] : undefined;
  return kana === "・" ? undefined : kana;
}

export function voicingVariants(kana: string): string[] {
  const consonant = consonantOf.get(kana);
  const vowel = vowelOf.get(kana);
  if (consonant === undefined || vowel === undefined) return [];
  const out: string[] = [];
  for (const [a, b] of VOICING) {
    const other = consonant === a ? b : consonant === b ? a : null;
    if (other === null) continue;
    const swapped = rowKana(other, vowel);
    if (swapped && swapped !== kana && !out.includes(swapped)) out.push(swapped);
  }
  return out;
}

const SMALL_TO_LARGE: Record<string, string> = { "ゃ": "や", "ゅ": "ゆ", "ょ": "よ", "っ": "つ", "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お" };
const LARGE_TO_SMALL: Record<string, string> = Object.fromEntries(Object.entries(SMALL_TO_LARGE).map(([s, l]) => [l, s]));

export const SOKUON = "っ";

const GEMINABLE = new Set(["k", "s", "t", "p"]);

export function isSmallKana(kana: string): boolean {
  return kana in SMALL_TO_LARGE;
}

export function isHiragana(text: string): boolean {
  return text.length > 0 && [...text].every((c) => c >= "ぁ" && c <= "ゖ");
}

export function isKanji(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  // 0x3005 is 々, which stands in for a kanji and carries its own reading.
  return code === 0x3005
    || (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf) || (code >= 0xf900 && code <= 0xfaff);
}

export function hasKanji(text: string): boolean {
  return [...text].some(isKanji);
}

export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function readingStem(reading: string): string {
  return toHiragana(reading).replace(/\(.*?\)/g, "").replace(/[\s・.,、]/g, "").trim();
}

export function readingList(field: string): string[] {
  if (!field || field === "—") return [];
  return [...new Set(field.split(/[,、]/).map(readingStem).filter((r) => r.length > 0 && isHiragana(r)))];
}


function longVowelMate(kana: string): string | null {
  const vowel = vowelOf.get(kana);
  if (vowel === "o") return "う";
  if (vowel === "u") return "う";
  return null;
}

function replaceAt(chars: string[], index: number, value: string): string {
  return [...chars.slice(0, index), value, ...chars.slice(index + 1)].join("");
}

const PALATALIZABLE = new Set(["き", "し", "ち", "に", "ひ", "み", "り", "ぎ", "じ", "び", "ぴ"]);
const SMALL_Y = new Set(["ゃ", "ゅ", "ょ"]);

export function isPlausibleReading(text: string): boolean {
  if (!isHiragana(text)) return false;
  const chars = [...text];
  const first = chars[0]!;
  if (first === SOKUON || first === "ん" || isSmallKana(first)) return false;
  if (chars.at(-1) === SOKUON) return false;
  return chars.every((kana, i) => {
    const next = chars[i + 1];
    if (kana === SOKUON) return next !== undefined && GEMINABLE.has(consonantOf.get(next) ?? "");
    if (SMALL_Y.has(kana)) return i > 0 && PALATALIZABLE.has(chars[i - 1]!);
    return true;
  });
}

export function phoneticVariants(reading: string): string[] {
  const chars = [...reading];
  const out: string[] = [];
  const add = (value: string) => {
    if (value !== reading && isPlausibleReading(value) && !out.includes(value)) out.push(value);
  };

  chars.forEach((kana, i) => {
    const next = chars[i + 1];

    const mate = longVowelMate(kana);
    if (mate && (next === mate || (vowelOf.get(kana) === "o" && next === "お"))) {
      add([...chars.slice(0, i + 1), ...chars.slice(i + 2)].join(""));
    } else if (mate && vowelOf.get(kana) === "o" && consonantOf.get(kana) && next !== "お"
      && vowelOf.get(chars[i - 1] ?? "") !== "o") {
      add([...chars.slice(0, i + 1), mate, ...chars.slice(i + 1)].join(""));
    }
    if (vowelOf.get(kana) === "o" && next === "う") {
      add(replaceAt(chars, i + 1, "お"));
    }

    if (kana === SOKUON) {
      add([...chars.slice(0, i), ...chars.slice(i + 1)].join(""));
    } else if (i > 0 && vowelOf.has(chars[i - 1]!) && GEMINABLE.has(consonantOf.get(kana) ?? "")) {
      add([...chars.slice(0, i), SOKUON, ...chars.slice(i)].join(""));
    }

    const large = SMALL_TO_LARGE[kana];
    if (large && kana !== SOKUON) add(replaceAt(chars, i, large));
    const small = LARGE_TO_SMALL[kana];
    if (small && i > 0 && vowelOf.get(chars[i - 1]!) === "i") add(replaceAt(chars, i, small));

    for (const swapped of voicingVariants(kana)) add(replaceAt(chars, i, swapped));
  });

  return out;
}

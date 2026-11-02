export type Furi = { t: string; r?: string };

export type Vocab = {
  w: string;
  r: string;
  m: string;
  f: Furi[]; // per-character readings; f.map(t).join("") === w
};

export type Kanji = {
  c: string;
  m: string;
  keyword?: string;
  on: string;
  kun: string;
  rad: string;
  mn: string;
  strokes: number;
  ch: number; // runtime region ID from regions.ts; source cards retain their legacy theme ID
  vocab: Vocab[];
};

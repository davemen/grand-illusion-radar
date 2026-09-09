import { classify } from '../lib/classify.mjs';
const cases = [
  { title: 'ZIG ZAG PLAYING CARD SUPER GREAT ILLUSION', price: 9.95 },
  { title: 'JUMBO ZIG ZAG CARD MAGIC TRICK - Stage Prop Poker Size Illusion Gimmick', price: 40.56 },
  { title: "Building Plans for Robert Harbin's Zig Zag Illusion!", price: 9.41 },
  { title: 'Zig Zag Girl Illusion - professional stage illusion, local pickup only, on casters', price: 3200 },
  { title: 'Owen Magic Supreme Sub Trunk Substitution Trunk illusion, crated, freight', price: 4800 },
  { title: 'John Gaughan Asrah Levitation - ex Doug Henning show', price: 18000 },
  { title: 'Optical Illusion Wall Art Poster Print 24x36', price: 19.99 },
  { title: 'Illusion Lace Wedding Dress Neckline Bridal Gown', price: 289 },
  { title: "Marvin's Magic 400 Tricks & Illusions Set", price: 20 },
  { title: 'Thin Model Sawing In Half Illusion, stage size, fits a person, $2900 obo', price: 2900 },
];
for (const c of cases) {
  const r = classify(c);
  console.log(`${r.verdict.toUpperCase().padEnd(10)} sc:${String(r.score).padStart(4)} ${r.deal ? `DEAL -${r.deal.pct}%` : '        '}  ${c.title.slice(0, 58)}`);
}

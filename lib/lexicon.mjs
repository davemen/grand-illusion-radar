// The canon of stage illusion — the vocabulary that separates real props from junk.
// Weights are deliberate: a named illusion is strong evidence, a named builder is stronger.

// ── Tier 1: named stage illusions. { re, name, tier, newPrice(USD, for deal math) }
export const ILLUSIONS = [
  // Sawing family
  ['zig ?zag(?! ?(card|stitch|pattern))', 'Zig Zag Girl', 1, 7500],
  ['thin (model )?saw(ing)?', 'Thin Model Sawing', 1, 6500],
  ['clearly impossible', 'Clearly Impossible', 1, 9000],
  ['table of death', 'Table of Death', 1, 12000],
  ['buzz ?saw', 'Buzz Saw', 1, 15000],
  ['chain ?saw (illusion|sawing)', 'Chainsaw Illusion', 1, 8000],
  ['saw(ing)? (a )?(lady|woman|girl|assistant|person) in (half|two)', 'Sawing in Half', 1, 5000],
  ['mis-?made (girl|lady|woman)', 'Mismade Girl', 1, 4500],
  ['wakeling', 'Wakeling Sawing', 1, 14000],
  ['bow saw', 'Bow Sawing', 1, 6000],
  // Box & cabinet family
  ['origami (illusion|box)?', 'Origami', 1, 8500],
  ['interlude', 'Interlude', 1, 7000],
  ['modern art', 'Modern Art', 1, 6500],
  ['shadow ?box', 'Shadow Box', 1, 5500],
  ['doll ?house', 'Doll House', 1, 6000],
  ['crystal casket', 'Crystal Casket', 1, 9500],
  ['blade ?box', 'Blade Box', 1, 3500],
  ['sword ?(box|cabinet)', 'Sword Box', 1, 4000],
  ['sword ?basket', 'Sword Basket', 1, 3000],
  ['basket (of )?(india|benares)', 'Basket of India', 1, 3000],
  ['(fu ?manchu|chamber of horrors)', 'Chamber of Fu Manchu', 1, 7000],
  ['spiker', 'Spiker', 1, 5000],
  ['impaled', 'Impaled', 1, 4500],
  ['girl without a middle', 'Girl Without a Middle', 1, 5500],
  ['disecto', 'Disecto', 2, 900],
  ['(head ?chopper|guillotine)', 'Head Chopper / Guillotine', 2, 1200],
  ['cremation', 'Cremation', 1, 6000],
  ['temple of benares', 'Temple of Benares', 1, 7500],
  ["assistant'?s revenge", "Assistant's Revenge", 1, 5000],
  ['backstage( illusion)?', 'Backstage', 1, 4500],
  ['(sub ?trunk|substitution trunk|metamorphosis)', 'Substitution Trunk', 1, 4000],
  ['costume trunk', 'Costume Trunk', 1, 5000],
  ['tip ?over (trunk|box)', 'Tip Over Trunk', 2, 2500],
  ['vanish(ing)? (cabinet|cage|throne)', 'Vanishing Cabinet', 1, 6000],
  ['twister( illusion)?', 'Twister', 1, 6500],
  ['pagoda( illusion)?', 'Pagoda', 1, 5000],
  ['elevator illusion', 'Elevator', 1, 8000],
  ['quantum leap', 'Quantum Leap', 1, 9000],
  ['sands of egypt', 'Sands of Egypt', 1, 4000],
  // Levitation & suspension
  ['asrah( levitation)?', 'Asrah Levitation', 1, 6000],
  ['super ?x( levitation)?', 'Super X Levitation', 1, 12000],
  ['broom suspension', 'Broom Suspension', 1, 3500],
  ['chair suspension', 'Chair Suspension', 1, 4000],
  ['aga levitation', 'Aga Levitation', 1, 7000],
  ['(levitation|suspension) (illusion|table|prop)', 'Levitation', 1, 5000],
  ['losander|floating table', 'Losander Floating Table', 2, 1800],
  // Productions, escapes, big iron
  ["lion'?s cage", "Lion's Cage", 1, 9000],
  ['water torture cell', 'Water Torture Cell', 1, 25000],
  ['milk can (escape|illusion)', 'Milk Can Escape', 2, 1500],
  ['(packing crate|crate escape)', 'Packing Crate Escape', 2, 2500],
  ['straight ?jacket|straitjacket', 'Straitjacket', 3, 300],
  ['production box', 'Production Box', 2, 700],
  ['square circle', 'Square Circle', 3, 300],
  ['dagger chest|dagger box', 'Dagger Chest', 1, 4000],
  ['arabian tent|arabian nights', 'Arabian Tent', 1, 5000],
  ['broom & basket|indian basket', 'Indian Basket', 1, 3000],
];

// ── Tier 0: the builders. A signed prop from these shops is the real thing.
export const BUILDERS = [
  ['john gaughan|gaughan', 'John Gaughan', 'grail'],
  ['robert harbin|harbin', 'Robert Harbin', 'grail'],
  ['owen magic|owen brothers', 'Owen Magic Supreme', 'grail'],
  ['(jim )?steinmeyer', 'Jim Steinmeyer', 'grail'],
  ['thayer', 'Thayer', 'grail'],
  ['(bill smith|magic ventures)', 'Bill Smith / Magic Ventures', 'top'],
  ['illusion warehouse', 'Illusion Warehouse', 'top'],
  ['paul osborne?', 'Paul Osborne', 'top'],
  ['andre kole', 'Andre Kole', 'top'],
  ['wellington( enterprises)?', 'Wellington Enterprises', 'top'],
  ["abbott'?s", "Abbott's Magic", 'top'],
  ['willard', 'Willard', 'top'],
  ['chuck smith', 'Chuck Smith', 'top'],
  ['michael baker', 'Michael Baker', 'top'],
  ['robert baxt', 'Robert Baxt', 'top'],
  ['creative illusion', 'Creative Illusion Designs', 'top'],
  ['vaudeville prop', 'Vaudeville Prop Shop', 'top'],
  ['don wayne', 'Don Wayne', 'top'],
  ['rand woodbury', 'Rand Woodbury', 'top'],
  ['dream illusions', 'Dream Illusions', 'good'],
  ['(the )?great distortions', 'Great Distortions', 'good'],
  ['viking (magic|mfg)', 'Viking Magic', 'good'],
  ['mak magic', 'MAK Magic', 'good'],
  ['hank lee', 'Hank Lee', 'good'],
  ['daytona magic', 'Daytona Magic', 'good'],
  ['tannen', "Tannen's Magic", 'good'],
];

// Performers whose provenance adds value
export const PROVENANCE = [
  ['doug henning', 'Doug Henning'], ['(david )?copperfield', 'David Copperfield'],
  ['lance burton', 'Lance Burton'], ['harry blackstone', 'Blackstone'],
  ['siegfried|roy', 'Siegfried & Roy'], ['mark wilson', 'Mark Wilson'],
  ['(the )?pendragons', 'The Pendragons'], ['harry houdini|houdini', 'Houdini'],
  ['criss angel', 'Criss Angel'], ['franz harary', 'Franz Harary'],
  ['(andre )?kole', 'Andre Kole'], ['channing pollock', 'Channing Pollock'],
];

// ── Physical scale: proof it is a big stage prop and not a pocket trick.
export const SCALE_SIGNALS = [
  ['crate[ds]?|crating', 3], ['freight|ltl shipping|shipping truck', 4],
  ['local pick ?up only|must pick ?up|pickup only|no shipping', 4],
  ['too (big|large|heavy) to ship', 4], ['stage size[d]?|full[- ]size[d]?', 3],
  ['professional stage', 2], ['road case|flight case|anvil case', 3],
  ['casters|castors|wheels', 2], ['(fits|holds) (a|an|one) (person|assistant|girl|woman|man)', 4],
  ['assistant', 2], ['illusion(s)?\\b', 1], ['stage illusion', 4],
  ['grand illusion', 4], ['plywood|birch ply|cabinet', 1],
  ['\\b\\d{2,4} ?(lb|lbs|pounds)\\b', 2], ["\\b[3-9] ?(ft|feet|')\\b", 2],
];

// ── The junk. This is where naive searches drown.
export const NEGATIVES = [
  ['optical illusion', 6], ['illusion (dress|gown|lace|neckline|sleeve|veil)', 8],
  ['wedding|bridal', 5], ['nail (polish|art)', 8], ['poster|lithograph|print|canvas art', 5],
  ['sticker|decal|t-?shirt|hoodie|mug', 6], ['(dvd|blu-?ray|vhs)\\b', 5],
  ['download|streaming|instant access', 5], ['\\bebook\\b|\\bpdf\\b', 5],
  ['card trick|playing cards?|deck of cards|svengali|bicycle deck', 6],
  ['close[- ]up|pocket trick|table hopping', 5], ['coin|sponge ball|thumb tip|silk hank', 5],
  ['\\bkids?\\b|children|toy|beginner set|starter kit', 5], ["marvin'?s magic|melissa & doug", 8],
  ['yu-?gi-?oh|pokemon|trading card', 9], ['figurine|miniature|1[:/]6 scale|model kit|diorama', 7],
  ['\\bfunko\\b|action figure', 8], ['puzzle|rubik', 5], ['costume|halloween mask', 3],
  ['\\bapp\\b|software|online course', 4], ['\\bring\\b|jewelry|necklace|earring', 5],
  ['tattoo|body art', 6], ['illusion (mirror|light|lamp|led|3d night)', 7],
  // Fine art & antiques depicting magicians — right subject, wrong object.
  ['oil painting|on canvas|watercolou?r|artist.?s proof|signed print|serigraph', 7],
  ['sculpture|statuary|bronze|automaton|music box', 6],
  ['\\bstamp\\b|postcard|trade card|cigarette card|photograph|cabinet card', 6],
  ['magazine|periodical|back issues?|newspaper', 7],
  // False friends: "Illusion" and "Magician" are also a hi-fi brand, a paint colour
  // and a bike model. Craigslist is full of them.
  ['amplifier|preamp|pre amp|receiver|turntable|speaker|subwoofer|stereo', 7],
  ['motorcycle|goldwing|harley|yamaha|kawasaki|scooter|e-?bike|electric bike|bicycle|sedan|coupe', 7],
  ['\\bsofa\\b|sectional|mattress|dresser|nightstand|lenestol', 6],
  // Tabletop-scale dimensions. A stage illusion is measured in feet, never in 15 inches.
  ['\\b\\d{1,2} ?(inch|inches|")', 4],
];

// Plans/books are a separate, legitimate category — not junk, but not a prop.
export const PLANS = [['(building )?plans?\\b', 'plans'], ['blueprint', 'plans'],
  ['\\bbook\\b|volume [ivx\\d]', 'book'], ['workshop manual', 'plans']];

// Anchor every pattern at a word start. Without this, short entries match inside
// longer words — "aga" fires on "maGAzine" and turns a magazine lot into a levitation.
export const compile = list => list.map(([re, ...rest]) =>
  [new RegExp(/^[a-z0-9]/i.test(re) ? `\\b(?:${re})` : re, 'i'), ...rest]);

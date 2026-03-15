export interface Reed {
  id: string;
  name: string;
  scientificName: string;
  author: string;
  rating: number;
  ratingsCount: number;
  reviewsCount: number;
  description: string;
  genre: string;
  pages: string; // "pages" = height in cm
  publishedDate: string; // "first published" = first catalogued
  coverEmoji: string;
  featured?: boolean;
  thinkingReed?: boolean;
}

export interface Review {
  reedId: string;
  reviewer: string;
  rating: number;
  date: string;
  text: string;
  likes: number;
}

export const REEDS: Reed[] = [
  {
    id: "common-reed",
    name: "Common Reed",
    scientificName: "Phragmites australis",
    author: "Mother Nature",
    rating: 4.2,
    ratingsCount: 127834,
    reviewsCount: 4521,
    description:
      "The bestselling reed of all time. Found on every continent except Antarctica, this reed has captivated audiences worldwide with its towering presence and feathery plumes. A true page-turner that grows up to 6 meters tall. Critics call it 'common' but there is nothing common about its global domination.",
    genre: "Marsh Fiction",
    pages: "600 cm",
    publishedDate: "~65 million BCE",
    coverEmoji: "🌾",
    featured: true,
  },
  {
    id: "giant-reed",
    name: "Giant Reed",
    scientificName: "Arundo donax",
    author: "Mother Nature",
    rating: 3.8,
    ratingsCount: 45221,
    reviewsCount: 1832,
    description:
      "An ambitious sequel to Common Reed that some say went too far. At 10 meters tall, Giant Reed has been called 'overwritten' and 'invasive' by critics — literally invasive, it's banned in several US states. Still, you can't deny its energy. This reed has been used to make clarinets and oboes since antiquity, proving that not all invasive literature is bad.",
    genre: "Epic Saga",
    pages: "1000 cm",
    publishedDate: "~30 million BCE",
    coverEmoji: "🎋",
  },
  {
    id: "reed-canary-grass",
    name: "Reed Canary Grass",
    scientificName: "Phalaris arundinacea",
    author: "Mother Nature & Carl Linnaeus (ed.)",
    rating: 3.1,
    ratingsCount: 22190,
    reviewsCount: 956,
    description:
      "A controversial entry in the reed canon. Some purists argue this is 'not even a real reed' — it's a grass that merely identifies as a reed. Nevertheless, it persists, spreading aggressively through wetlands and sparking heated debates on Reed Twitter. Contains trace amounts of DMT, which may explain some of the five-star reviews.",
    genre: "Psychedelic Non-Fiction",
    pages: "200 cm",
    publishedDate: "1753 (first edition by Linnaeus)",
    coverEmoji: "🌿",
  },
  {
    id: "papyrus",
    name: "Papyrus",
    scientificName: "Cyperus papyrus",
    author: "The Nile Delta Collective",
    rating: 4.8,
    ratingsCount: 312456,
    reviewsCount: 12033,
    description:
      "The OG. The reed that literally invented reading. Without Papyrus, there would be no Good Reeds — or any other literary platform, for that matter. Ancient Egyptians used this reed to create the first paper, essentially making Papyrus the world's first self-help book: it helped everyone else write books. A masterpiece of recursive brilliance.",
    genre: "Historical Meta-Fiction",
    pages: "500 cm",
    publishedDate: "~3000 BCE (first print run)",
    coverEmoji: "📜",
    featured: true,
    thinkingReed: true,
  },
  {
    id: "sugar-cane",
    name: "Sugar Cane",
    scientificName: "Saccharum officinarum",
    author: "Southeast Asian Growers' Guild",
    rating: 4.5,
    ratingsCount: 198234,
    reviewsCount: 7844,
    description:
      "Sweet, addictive, and impossible to put down. Sugar Cane has fuelled entire economies, toppled governments, and rotted countless teeth. Technically a grass, but we don't gatekeep here at Good Reeds. This is the reed equivalent of a beach read — pure guilty pleasure. Side effects may include colonialism.",
    genre: "Sweet Romance",
    pages: "550 cm",
    publishedDate: "~8000 BCE",
    coverEmoji: "🍬",
  },
  {
    id: "bamboo",
    name: "Bamboo",
    scientificName: "Bambusoideae",
    author: "Pan Da (pseudonym)",
    rating: 4.6,
    ratingsCount: 267891,
    reviewsCount: 9122,
    description:
      "The fastest-growing narrative in botanical literature — some species grow 91 cm per day. Bamboo is less of a reed and more of a lifestyle brand at this point: flooring, furniture, clothing, food, scaffolding, musical instruments. Is there anything it can't do? (Yes: it can't stop being technically a grass. But again, no gatekeeping.)",
    genre: "Self-Help / Productivity",
    pages: "3000 cm",
    publishedDate: "~40 million BCE",
    coverEmoji: "🎍",
    featured: true,
  },
  {
    id: "cattail",
    name: "Cattail",
    scientificName: "Typha latifolia",
    author: "Swamp Thing",
    rating: 3.9,
    ratingsCount: 56432,
    reviewsCount: 2311,
    description:
      "Neither a cat nor a tail, Cattail is the reed world's greatest misnomer. Its distinctive brown cigar-shaped flower head has made it the most recognizable silhouette in wetland literature. Edible, medicinal, and a natural water purifier — Cattail is the swiss army knife of reeds. Some say it's not a reed at all. To them we say: have you seen the thing? It's reedy enough.",
    genre: "Mystery / Thriller",
    pages: "300 cm",
    publishedDate: "~80 million BCE",
    coverEmoji: "🌱",
  },
  {
    id: "pascals-reed",
    name: "Pascal's Reed (L'homme est un roseau pensant)",
    scientificName: "Homo sapiens reedicus",
    author: "Blaise Pascal",
    rating: 5.0,
    ratingsCount: 1,
    reviewsCount: 1,
    description:
      "The most philosophical reed ever conceived. In his Pensées, Pascal declared that 'Man is but a reed, the most feeble thing in nature; but he is a thinking reed.' This single metaphor elevated the entire reed kingdom from botanical obscurity to existential grandeur. Is it a reed? Is it a human? Is it a metaphor? Yes.",
    genre: "Philosophy / Existential Horror",
    pages: "∞",
    publishedDate: "1670",
    coverEmoji: "🤔",
    featured: true,
    thinkingReed: true,
  },
  {
    id: "bulrush",
    name: "Bulrush",
    scientificName: "Schoenoplectus lacustris",
    author: "Moses' Mom (Anonymous)",
    rating: 4.7,
    ratingsCount: 234567,
    reviewsCount: 8923,
    description:
      "The most famous cameo in literary history. Bulrush's big break came when a desperate mother placed baby Moses in a basket among the bulrushes of the Nile, essentially making this reed the original baby crib AND the catalyst for the entire Exodus narrative. Without Bulrush, no Ten Commandments, no parting of the Red Sea, no Charlton Heston movie. That's a lot of plot weight for a wetland plant. The only reed with a Screen Actors Guild credit.",
    genre: "Biblical Epic / Nursery Literature",
    pages: "300 cm",
    publishedDate: "~1500 BCE (first appearance in Exodus)",
    coverEmoji: "👶",
    featured: true,
  },
  {
    id: "horsetail",
    name: "Horsetail",
    scientificName: "Equisetum arvense",
    author: "The Carboniferous Period",
    rating: 4.1,
    ratingsCount: 95432,
    reviewsCount: 4102,
    description:
      "A living fossil that has been in print for 350 MILLION YEARS. To put that in perspective, Horsetail was already a classic when dinosaurs were still in development. It survived the Permian extinction, the K-T extinction, and the rise of Twitter — making it the single most resilient publication in Earth's history. Modern horsetails are miniature versions of their 30-meter-tall Carboniferous ancestors, which is the botanical equivalent of a director's cut being shorter than the theatrical release.",
    genre: "Prehistoric Non-Fiction",
    pages: "60 cm (formerly 3000 cm)",
    publishedDate: "~350 million BCE (oldest reed in print)",
    coverEmoji: "🦕",
    thinkingReed: true,
  },
  {
    id: "scotch-broom",
    name: "Scotch Broom",
    scientificName: "Cytisus scoparius",
    author: "The Scottish Highlands Collective (Unwanted Edition)",
    rating: 2.3,
    ratingsCount: 67812,
    reviewsCount: 3401,
    description:
      "The literary equivalent of that friend who shows up uninvited, eats all your food, and then invites their entire extended family. Scotch Broom is officially classified as a 'noxious weed' in 8 US states, which is the botanical equivalent of being banned from Goodreads for toxicity. Originally imported for 'ornamental purposes' — a decision that historians now rank alongside 'let's see what's inside this Pandora's box.' Beautiful yellow flowers, though.",
    genre: "Invasion Thriller",
    pages: "300 cm",
    publishedDate: "1800s (Unauthorized US Release)",
    coverEmoji: "💛",
  },
  {
    id: "sea-oat",
    name: "Sea Oat",
    scientificName: "Uniola paniculata",
    author: "The Gulf Coast Beach Bums Association",
    rating: 4.4,
    ratingsCount: 88234,
    reviewsCount: 3912,
    description:
      "The chillest reed in the entire catalogue. Sea Oat doesn't invade, doesn't cause controversy, doesn't have an existential crisis — it just vibes on the dunes, holds the sand together, and looks gorgeous at sunset. It's so laid-back that it's actually illegal to pick it in most coastal states, making it the only reed with its own restraining order against humans. If Common Reed is a bestseller and Giant Reed is an epic saga, Sea Oat is a lo-fi beats playlist in plant form.",
    genre: "Beach Read (Literally)",
    pages: "180 cm",
    publishedDate: "~10 million BCE",
    coverEmoji: "🏖️",
  },
];

export const REVIEWS: Review[] = [
  {
    reedId: "common-reed",
    reviewer: "WetlandWanderer42",
    rating: 5,
    date: "March 2, 2026",
    text: "I've been reading Common Reed for years and it never gets old. Every spring, a new chapter unfurls. The character development is slow but deeply rooted. My only complaint is that it keeps spreading into my neighbor's yard, but I suppose that's just good world-building.",
    likes: 234,
  },
  {
    reedId: "common-reed",
    reviewer: "BogEnthusiast",
    rating: 3,
    date: "January 15, 2026",
    text: "Overhyped. Sure, it's everywhere, but so is mediocrity. I expected more from a reed with 'common' right there in the name. At least it's honest about what it is. Three stars for self-awareness.",
    likes: 89,
  },
  {
    reedId: "papyrus",
    reviewer: "NileReeder",
    rating: 5,
    date: "February 28, 2026",
    text: "Without Papyrus, I literally could not write this review. Five stars for enabling the very concept of literacy. Also it looks fantastic in my bathroom.",
    likes: 1023,
  },
  {
    reedId: "papyrus",
    reviewer: "ThinkingReedFan",
    rating: 5,
    date: "December 1, 2025",
    text: "Papyrus is the only reed that has written more books than it has leaves. The ultimate meta-reed. When you gaze into the Papyrus, the Papyrus gazes also into you.",
    likes: 567,
  },
  {
    reedId: "bamboo",
    reviewer: "PandaLover88",
    rating: 5,
    date: "March 10, 2026",
    text: "Delicious. Wait, am I reviewing the right kind of thing here? Anyway, five stars, would eat again. The crunch is *chef's kiss*. My favorite part is the part where I eat it.",
    likes: 4521,
  },
  {
    reedId: "bamboo",
    reviewer: "ArchitectMike",
    rating: 4,
    date: "February 5, 2026",
    text: "Built my entire house out of bamboo. Incredibly versatile material. Took one star off because the house makes panda-attracting noises at night. Three pandas have moved in. They don't pay rent.",
    likes: 892,
  },
  {
    reedId: "giant-reed",
    reviewer: "ClarinetCarl",
    rating: 4,
    date: "November 20, 2025",
    text: "My clarinet reed comes from this plant. I've spent more money on Arundo donax reeds than on my mortgage. Each one lasts about 3 weeks before it sounds like a dying duck. Still, when a good reed hits, it hits different. Four stars (would be five if they lasted longer than my attention span).",
    likes: 345,
  },
  {
    reedId: "pascals-reed",
    reviewer: "BlaisePascal",
    rating: 5,
    date: "August 19, 1662",
    text: "L'homme n'est qu'un roseau, le plus faible de la nature; mais c'est un roseau pensant. I should know — I invented this reed. It's the finest reed I've ever conceived, and I've conceived of quite a few things (see: Pascal's Triangle, Pascal's Wager, the Pascaline calculator). This reed thinks, therefore it reeds.",
    likes: 99999,
  },
  {
    reedId: "sugar-cane",
    reviewer: "DentistDread",
    rating: 2,
    date: "January 3, 2026",
    text: "As a dentist, I am legally obligated to give Sugar Cane two stars. It tastes incredible but has caused more cavities than all other reeds combined. Also it's responsible for significant historical atrocities but the Goodreeds — sorry, Good Reeds — review guidelines say to focus on the reed itself, so: tasty, problematic, 2/5.",
    likes: 677,
  },
  {
    reedId: "cattail",
    reviewer: "SurvivalistSteve",
    rating: 5,
    date: "March 12, 2026",
    text: "If you're stranded in the wilderness, Cattail is your best friend. You can eat it, build with it, use it as tinder, stuff it in your jacket for insulation, and use the fluff as wound dressing. Five stars. This reed has saved my life at least three times and I've only been camping twice.",
    likes: 2134,
  },
  {
    reedId: "reed-canary-grass",
    reviewer: "ControversialOpinionsBot",
    rating: 1,
    date: "February 14, 2026",
    text: "This is NOT A REED. I will die on this hill. It's a GRASS. It says GRASS right there in the name. 'Reed Canary GRASS.' I'm starting a petition to have it removed from Good Reeds. This is a slippery slope — next thing you know, they'll be reviewing lawn grass and wheat.",
    likes: 42,
  },
  {
    reedId: "reed-canary-grass",
    reviewer: "GrassIsReedToo",
    rating: 5,
    date: "February 14, 2026",
    text: "Replying to ControversialOpinionsBot: Imagine gatekeeping REEDS. Touch grass. Or better yet, touch Reed Canary Grass. Five stars out of spite.",
    likes: 420,
  },
  {
    reedId: "bulrush",
    reviewer: "MarshMellow",
    rating: 5,
    date: "March 14, 2026",
    text: "I can't believe this reed literally saved Moses and then just went back to being a regular swamp plant like nothing happened. Absolute legend. No ego whatsoever. Five stars for humility. Most reeds would have leveraged that into a brand deal.",
    likes: 3456,
  },
  {
    reedId: "horsetail",
    reviewer: "PhDinBotany",
    rating: 4,
    date: "February 22, 2026",
    text: "As someone who has spent 11 years studying Equisetum, I need to clarify several inaccuracies in the other reviews. First, Horsetail is technically NOT a reed, it's a pteridophyte. Second, it reproduces via spores, not seeds. Third, my dissertation advisor still hasn't read my thesis about it. Four stars because despite everything I just said, it's genuinely cool that this plant predates trees.",
    likes: 892,
  },
  {
    reedId: "scotch-broom",
    reviewer: "ReedBetweenTheLines",
    rating: 1,
    date: "January 30, 2026",
    text: "One star. This reed moved into my garden in 2019 and now it owns the garden. I don't own the garden anymore. Scotch Broom owns the garden. I've tried pulling it out, poisoning it, yelling at it, reasoning with it, and writing it a strongly worded letter. It responded by flowering even more aggressively. I'm now paying rent to a shrub. Do NOT recommend.",
    likes: 5678,
  },
  {
    reedId: "sea-oat",
    reviewer: "BeachBotanist420",
    rating: 5,
    date: "March 8, 2026",
    text: "Sea Oat is the Bob Ross of reeds. It doesn't bother anyone, it just holds the dunes together and waves gently in the ocean breeze. I once sat on a Florida beach for four hours watching sea oats sway and it was the most productive day of my life. Five stars, would contemplate again.",
    likes: 2345,
  },
  {
    reedId: "horsetail",
    reviewer: "TimelineTracker",
    rating: 5,
    date: "March 1, 2026",
    text: "HORSETAIL HAS BEEN ALIVE SINCE BEFORE PANGAEA BROKE UP. It has survived FIVE mass extinction events. It watched the dinosaurs come and go. It was here before flowers existed. Every time I look at a horsetail, I have to lie down for twenty minutes because the temporal vertigo is too much. Five stars just through sheer obstinacy. Respect your elders.",
    likes: 7891,
  },
  {
    reedId: "bamboo",
    reviewer: "MarshMellow",
    rating: 4,
    date: "February 18, 2026",
    text: "Planted bamboo in my backyard three years ago for 'a nice privacy screen.' It is now a privacy fortress. I have privacy from the neighbors, the mailman, natural light, and GPS satellites. My house doesn't appear on Google Maps anymore. The bamboo has consumed the shed. I can hear it growing at night. Four stars because the shoots are delicious in stir fry.",
    likes: 4123,
  },
  {
    reedId: "scotch-broom",
    reviewer: "NativeSpeciesDefender",
    rating: 1,
    date: "March 5, 2026",
    text: "I organized a 'Scotch Broom Pull' volunteer event last weekend. Thirty people showed up. We pulled broom for six hours. On Monday I drove past the site and it looked like we'd never been there. The broom had regenerated overnight like some kind of botanical Wolverine. I'm beginning to think Scotch Broom is not a plant but a curse placed upon us by a witch who was really into yellow.",
    likes: 3210,
  },
  {
    reedId: "papyrus",
    reviewer: "PhDinBotany",
    rating: 5,
    date: "January 12, 2026",
    text: "I wrote my entire doctoral thesis on the cultural impact of Cyperus papyrus, and the irony of writing a paper about the plant that invented paper was not lost on my committee. They still failed me. But PAPYRUS would never fail me. Papyrus believes in me. Five stars for the only reed that doubles as emotional support.",
    likes: 1567,
  },
];

export const PASCAL_QUOTES = [
  {
    text: "Man is but a reed, the most feeble thing in nature; but he is a thinking reed.",
    source: "Pensées, §347",
  },
  {
    text: "The entire universe need not arm itself to crush him. A vapour, a drop of water suffices to kill him. But, if the universe were to crush him, man would still be more noble than that which killed him, because he knows that he dies.",
    source: "Pensées, §347",
  },
  {
    text: "It is not from space that I must seek my dignity, but from the government of my thought. I shall have no more if I possess worlds. By space the universe encompasses and swallows me up like an atom; by thought I comprehend the world.",
    source: "Pensées, §348",
  },
  {
    text: "The heart has its reasons which reason knows nothing of... We know the truth not only by the reason, but by the heart.",
    source: "Pensées, §277",
  },
  {
    text: "All of humanity's problems stem from man's inability to sit quietly in a room.",
    source: "Pensées, §139",
  },
  {
    text: "I have discovered that all the unhappiness of men arises from one single fact, that they cannot stay quietly in their own reed bed.",
    source: "Pensées, §139 (Good Reeds Edition™)",
  },
  {
    text: "If I had more time, I would have written a shorter reed.",
    source: "Lettres Provinciales, §XVI (Good Reeds Edition™)",
  },
  {
    text: "The reed bends but does not break. Unlike my spirit after reading the comments section on Reed Canary Grass.",
    source: "Pensées, §402 (Good Reeds Edition™)",
  },
  {
    text: "Men despise reeds; they call them common, they mow them down, they pave over their marshes. But take away the reeds and the water has nowhere to go, and the men have wet basements. Thus the reed has the last laugh.",
    source: "Pensées, §742 (Good Reeds Edition™)",
  },
  {
    text: "Pascal's Wager, but for reeds: If reeds are sentient and you were nice to them, you gain everything. If they're not sentient, you lose nothing. Therefore, talk to your reeds.",
    source: "Pensées, §233 (Good Reeds Edition™)",
  },
  {
    text: "The eternal silence of these infinite reed beds terrifies me.",
    source: "Pensées, §206 (Good Reeds Edition™)",
  },
];

export const REED_SHELVES = [
  { name: "Want to Reed", count: 47, emoji: "📋" },
  { name: "Currently Reeding", count: 3, emoji: "👀" },
  { name: "Reed", count: 156, emoji: "✅" },
  { name: "Dried & Pressed", count: 23, emoji: "🥀" },
  { name: "Invasive Species (DNR)", count: 8, emoji: "🚫" },
  { name: "Thinking Reeds Only", count: 2, emoji: "🤔" },
];

export const GENRES = [
  { name: "Marsh Fiction", count: 12453, emoji: "🏞️" },
  { name: "Wetland Romance", count: 8921, emoji: "💚" },
  { name: "Bog Horror", count: 3456, emoji: "👻" },
  { name: "Sweet Romance", count: 7823, emoji: "🍬" },
  { name: "Historical Meta-Fiction", count: 5634, emoji: "📜" },
  { name: "Self-Help / Productivity", count: 9102, emoji: "📈" },
  { name: "Epic Saga", count: 4521, emoji: "⚔️" },
  { name: "Philosophy / Existential Horror", count: 1670, emoji: "🤔" },
  { name: "Psychedelic Non-Fiction", count: 420, emoji: "🌈" },
  { name: "Mystery / Thriller", count: 6789, emoji: "🔍" },
  { name: "Invasion Thriller", count: 6712, emoji: "🦠" },
  { name: "Beach Read (Literally)", count: 3344, emoji: "🏖️" },
  { name: "Biblical Epic / Nursery Literature", count: 2891, emoji: "👶" },
  { name: "Prehistoric Non-Fiction", count: 1203, emoji: "🦕" },
];

export interface ReedingList {
  name: string;
  description: string;
  reedCount: number;
  followers: number;
  emoji: string;
}

export const REEDING_LISTS: ReedingList[] = [
  {
    name: "Best Reeds of 2026",
    description: "The most critically acclaimed reeds of the year, as voted by our community of over 89,000 active reed beds.",
    reedCount: 47,
    followers: 23401,
    emoji: "🏆",
  },
  {
    name: "Reeds That Will Make You Cry",
    description: "Emotionally devastating reeds. Have tissues ready. Mostly about endangered species and wetland destruction.",
    reedCount: 31,
    followers: 15678,
    emoji: "😭",
  },
  {
    name: "If You Liked Grass, Try These Reeds",
    description: "A gateway list for grass enthusiasts curious about the reed lifestyle. No judgment. We all start somewhere.",
    reedCount: 24,
    followers: 8901,
    emoji: "🌱",
  },
  {
    name: "Invasive Reeds Your Neighbors Will Hate",
    description: "Plant these at your own legal and social risk. Good Reeds assumes no liability for HOA violations.",
    reedCount: 18,
    followers: 42069,
    emoji: "😈",
  },
  {
    name: "Reeds to Reed Before You Die",
    description: "The definitive bucket list for the discerning reed observer. Life is short. Reeds are tall.",
    reedCount: 100,
    followers: 67234,
    emoji: "💀",
  },
  {
    name: "Cozy Reeds for a Rainy Day",
    description: "Reeds that pair well with a warm blanket, a cup of tea, and the gentle sound of wetland precipitation.",
    reedCount: 22,
    followers: 19456,
    emoji: "🌧️",
  },
  {
    name: "Enemies-to-Lovers (Reed Edition)",
    description: "Reeds you hated at first but grew to love. Mostly invasive species that turned out to be ecologically useful.",
    reedCount: 9,
    followers: 5432,
    emoji: "💚",
  },
  {
    name: "Thinking Reeds Only (No Vibes)",
    description: "Intellectually rigorous reeds. If you can't handle a reed that quotes Sartre, this list isn't for you.",
    reedCount: 3,
    followers: 1670,
    emoji: "🧠",
  },
];

export const ABOUT_GOOD_REEDS = {
  tagline: "The world's largest platform for reed reviews, reed-commendations, and existential crises about being a thinking reed.",

  paragraphs: [
    "Good Reeds was founded in ~65 million BCE by a group of Phragmites australis enthusiasts who believed that every reed deserves to be rated on a five-star scale. What began as a small wetland zine has grown into the internet's premier destination for reed discourse, boasting over 12,847 catalogued species and a community of 89,234 active reed beds.",
    "Our mission is simple: to help people find their next great reed. Whether you're a casual marsh-walker looking for a quick beach read (try Sea Oat), a serious botanist seeking peer-reviewed reed-search, or a 17th-century French philosopher wondering if a reed can think — Good Reeds has something for you.",
    'We are frequently asked: "Is this a website about books or about reeds?" The answer is yes. The boundary between reeds and reading was never as firm as people think. The word \'library\' comes from the Latin \'liber,\' meaning bark. Papyrus is literally a reed that became a book. We\'re not blurring lines — we\'re revealing that the lines were never there. Also, reed/read puns are just really fun and we refuse to apologize.',
    "Good Reeds is not affiliated with Goodreads, Amazon, or any actual botanical institution. We have, however, received a cease-and-desist letter from the International Phragmites Consortium, which we have framed and hung in our office (a particularly dense stand of Common Reed in an undisclosed marsh).",
    "Fun fact: Our entire platform runs on servers powered by biomass energy from sustainably harvested Giant Reed. This is not true, but it feels like it should be, and that's what Good Reeds is all about.",
  ],

  founderQuote: {
    text: "I started Good Reeds because I kept going to Goodreads looking for information about reeds, and was disappointed every single time. The market had a gap. That gap was shaped like a reed.",
    attribution: 'A. Reed, Founder & CEO (probably a reed in a trench coat)',
  },
};

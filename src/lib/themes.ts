"use client";

export interface Theme {
  key: string;
  label: string;
  emoji: string;
  icon: string;
  feeling: string;
  description: string;
  artwork: string;
  ambient: string[];
  palette: string[];
  free: boolean;
  bg: string;
  card: string;
  ink: string;
  edge: string;
  fg: string;
  dim: string;
  faint: string;
  button: string;
  calm: string;
  sea: string;
  bgRgb: string;
  cardRgb: string;
  inkRgb: string;
  edgeRgb: string;
  fgRgb: string;
  dimRgb: string;
  faintRgb: string;
  buttonRgb: string;
  calmRgb: string;
  seaRgb: string;
  unlockType?: "reflections" | "plus" | "seasonal";
  unlockReflections?: number;
}

export const THEMES: Theme[] = [
  {
    key: "blossom",
    label: "Blossom Garden",
    emoji: "lotus",
    icon: "lotus",
    feeling: "Peace, reflection, new beginnings",
    description:
      "A peaceful lotus pond where every reflection helps your sanctuary bloom.",
    artwork: "/sanctuary/lotus_blossom.PNG",
    ambient: ["Floating petals", "Gentle ripples", "Fireflies", "Soft glow"],
    palette: ["Lavender", "Soft Violet", "Sage Green", "Rose Pink", "Mist Gray"],
    free: true,
    bg: "#171126",
    card: "#251934",
    ink: "#100B1B",
    edge: "#5E4775",
    fg: "#FFF7FF",
    dim: "#E2CBE8",
    faint: "#A78CAF",
    button: "#8D5DAD",
    calm: "#E7A6D8",
    sea: "#BDA9FF",
    bgRgb: "23 17 38",
    cardRgb: "37 25 52",
    inkRgb: "16 11 27",
    edgeRgb: "94 71 117",
    fgRgb: "255 247 255",
    dimRgb: "226 203 232",
    faintRgb: "167 140 175",
    buttonRgb: "141 93 173",
    calmRgb: "231 166 216",
    seaRgb: "189 169 255",
    unlockType: "reflections",
    unlockReflections: 14,
  },
  {
    key: "twilight",
    label: "Twilight Grove",
    emoji: "moon",
    icon: "moon",
    feeling: "Evening, rest, stillness",
    description:
      "A quiet grove beneath the evening sky where moonlight, stars, and peaceful paths help you leave the day behind.",
    artwork: "/sanctuary/twilight_grove.PNG",
    ambient: ["Twinkling stars", "Slow clouds", "Moon glow", "Fireflies"],
    palette: ["Midnight Purple", "Indigo", "Moon Silver", "Lavender", "Dark Pine"],
    free: true,
    bg: "#111024",
    card: "#1C1830",
    ink: "#0F0E1C",
    edge: "#4A3E68",
    fg: "#F8F5FF",
    dim: "#C8BCE6",
    faint: "#8E82AD",
    button: "#5B3BB7",
    calm: "#B894FF",
    sea: "#D8C4FF",
    bgRgb: "17 16 36",
    cardRgb: "28 24 48",
    inkRgb: "15 14 28",
    edgeRgb: "74 62 104",
    fgRgb: "248 245 255",
    dimRgb: "200 188 230",
    faintRgb: "142 130 173",
    buttonRgb: "91 59 183",
    calmRgb: "184 148 255",
    seaRgb: "216 196 255",
    unlockType: "reflections",
    unlockReflections: 0,
  },
  {
    key: "ocean",
    label: "Ocean Shore",
    emoji: "wave",
    icon: "wave",
    feeling: "Breathe, release, clarity",
    description:
      "Gentle waves and endless horizons create space to breathe deeply, reset your thoughts, and let the tide carry away today's worries.",
    artwork: "/sanctuary/ocean_calm.PNG",
    ambient: ["Moving waves", "Ocean mist", "Flying birds", "Water shimmer"],
    palette: ["Ocean Blue", "Teal", "Seafoam", "Soft Coral", "Mist Gray"],
    free: false,
    bg: "#071420",
    card: "#0E2230",
    ink: "#06101A",
    edge: "#315466",
    fg: "#F1FAFF",
    dim: "#B7D4DE",
    faint: "#7895A3",
    button: "#2D5D72",
    calm: "#87B8C9",
    sea: "#F2A58C",
    bgRgb: "7 20 32",
    cardRgb: "14 34 48",
    inkRgb: "6 16 26",
    edgeRgb: "49 84 102",
    fgRgb: "241 250 255",
    dimRgb: "183 212 222",
    faintRgb: "120 149 163",
    buttonRgb: "45 93 114",
    calmRgb: "135 184 201",
    seaRgb: "242 165 140",
    unlockType: "reflections",
    unlockReflections: 21,
  },
  {
    key: "forest",
    label: "Forest Haven",
    emoji: "tree",
    icon: "tree",
    feeling: "Grounded, nature, comfort",
    description:
      "A peaceful woodland retreat filled with flowing streams, towering trees, and quiet trails that help you reconnect with yourself.",
    artwork: "/sanctuary/forest_haven.PNG",
    ambient: ["Birds", "Flowing stream", "Floating pollen", "Gentle breeze"],
    palette: ["Forest Green", "Moss", "Bark Brown", "Lavender Shadows", "Warm Sunlight"],
    free: false,
    bg: "#0C1511",
    card: "#17241D",
    ink: "#090F0C",
    edge: "#3F5548",
    fg: "#F5FBF4",
    dim: "#C8D6C7",
    faint: "#8D9E8E",
    button: "#536B58",
    calm: "#A9B99B",
    sea: "#D4C7A1",
    bgRgb: "12 21 17",
    cardRgb: "23 36 29",
    inkRgb: "9 15 12",
    edgeRgb: "63 85 72",
    fgRgb: "245 251 244",
    dimRgb: "200 214 199",
    faintRgb: "141 158 142",
    buttonRgb: "83 107 88",
    calmRgb: "169 185 155",
    seaRgb: "212 199 161",
    unlockType: "reflections",
    unlockReflections: 7,
  },
  {
    key: "sunrise",
    label: "Sunrise Meadow",
    emoji: "sunset",
    icon: "sunset",
    feeling: "Gratitude, hope, closure",
    description:
      "Golden fields beneath a colorful sunset remind you that every ending is also the beginning of something new.",
    artwork: "/sanctuary/sunset_fields.PNG",
    ambient: ["Swaying grass", "Birds", "Warm sunlight", "Floating seeds"],
    palette: ["Golden Amber", "Peach", "Warm Orange", "Pink", "Lavender"],
    free: false,
    bg: "#1B1326",
    card: "#281B32",
    ink: "#120D1B",
    edge: "#5B4563",
    fg: "#FFF7F4",
    dim: "#DFC7D1",
    faint: "#A58A9A",
    button: "#7A4E68",
    calm: "#E5A65C",
    sea: "#D989B2",
    bgRgb: "27 19 38",
    cardRgb: "40 27 50",
    inkRgb: "18 13 27",
    edgeRgb: "91 69 99",
    fgRgb: "255 247 244",
    dimRgb: "223 199 209",
    faintRgb: "165 138 154",
    buttonRgb: "122 78 104",
    calmRgb: "229 166 92",
    seaRgb: "217 137 178",
    unlockType: "reflections",
    unlockReflections: 28,
  },
  {
    key: "mountain",
    label: "Mountain Retreat",
    emoji: "mountain",
    icon: "mountain",
    feeling: "Strength, perspective, achievement",
    description:
      "High above the clouds, each reflection reminds you how far you've climbed and how much you've grown.",
    artwork: "/sanctuary/mountain_peak.PNG",
    ambient: ["Clouds", "Mountain breeze", "Snow particles", "Distant birds"],
    palette: ["Slate Blue", "Snow White", "Granite Gray", "Frost Blue", "Lavender Sky"],
    free: false,
    bg: "#111627",
    card: "#1B2238",
    ink: "#0B1020",
    edge: "#485676",
    fg: "#F7FAFF",
    dim: "#C8D2EA",
    faint: "#8897B5",
    button: "#4E5D82",
    calm: "#A9BFE8",
    sea: "#D3B0FF",
    bgRgb: "17 22 39",
    cardRgb: "27 34 56",
    inkRgb: "11 16 32",
    edgeRgb: "72 86 118",
    fgRgb: "247 250 255",
    dimRgb: "200 210 234",
    faintRgb: "136 151 181",
    buttonRgb: "78 93 130",
    calmRgb: "169 191 232",
    seaRgb: "211 176 255",
    unlockType: "reflections",
    unlockReflections: 24,
  },
  {
    key: "misty",
    label: "Misty Hollow",
    emoji: "cloud",
    icon: "cloud",
    feeling: "Fresh start, possibility, gentleness",
    description:
      "Soft morning mist rolls across blooming meadows where quiet paths encourage curiosity and peaceful reflection.",
    artwork: "/sanctuary/misty_meadows.PNG",
    ambient: ["Morning fog", "Wildflowers", "Floating pollen", "Butterflies"],
    palette: ["Mist Gray", "Sage", "Pale Blue", "Lavender", "Soft Green"],
    free: false,
    bg: "#111827",
    card: "#1C2433",
    ink: "#0B111C",
    edge: "#46556C",
    fg: "#F5F8FF",
    dim: "#C9D4E4",
    faint: "#8E9BB0",
    button: "#596B76",
    calm: "#B2C8B3",
    sea: "#B8A7DF",
    bgRgb: "17 24 39",
    cardRgb: "28 36 51",
    inkRgb: "11 17 28",
    edgeRgb: "70 85 108",
    fgRgb: "245 248 255",
    dimRgb: "201 212 228",
    faintRgb: "142 155 176",
    buttonRgb: "89 107 118",
    calmRgb: "178 200 179",
    seaRgb: "184 167 223",
    unlockType: "reflections",
    unlockReflections: 27,
  },
  {
    key: "desert",
    label: "Desert Oasis",
    emoji: "cactus",
    icon: "cactus",
    feeling: "Stillness, simplicity, resilience",
    description:
      "Wide open skies and quiet desert landscapes invite you to slow down, breathe deeply, and appreciate life's quiet moments.",
    artwork: "/sanctuary/desert_dusk.PNG",
    ambient: ["Wind", "Sand drifting", "Warm glow", "Desert plants"],
    palette: ["Terracotta", "Sand", "Dusty Purple", "Sunset Orange", "Warm Brown"],
    free: false,
    bg: "#1E141E",
    card: "#2C1E2A",
    ink: "#120C13",
    edge: "#684B55",
    fg: "#FFF5EF",
    dim: "#DFC7BE",
    faint: "#A98E88",
    button: "#8A4F3B",
    calm: "#D17A52",
    sea: "#B583C7",
    bgRgb: "30 20 30",
    cardRgb: "44 30 42",
    inkRgb: "18 12 19",
    edgeRgb: "104 75 85",
    fgRgb: "255 245 239",
    dimRgb: "223 199 190",
    faintRgb: "169 142 136",
    buttonRgb: "138 79 59",
    calmRgb: "209 122 82",
    seaRgb: "181 131 199",
    unlockType: "reflections",
    unlockReflections: 30,
  },
  {
    key: "snowfall",
    label: "Winter Retreat",
    emoji: "snow",
    icon: "snowflake",
    feeling: "Quiet, comfort, peace",
    description:
      "Fresh snow blankets a peaceful winter retreat where the world slows down and every reflection feels warm and comforting.",
    artwork: "/sanctuary/snowfall_retreat.PNG",
    ambient: ["Falling snow", "Gentle wind", "Frost sparkle", "Cabin smoke"],
    palette: ["Snow White", "Ice Blue", "Frost Lavender", "Deep Evergreen", "Soft Silver"],
    free: false,
    bg: "#11182A",
    card: "#1B2438",
    ink: "#0A1020",
    edge: "#465875",
    fg: "#F8FBFF",
    dim: "#CDD8EA",
    faint: "#91A1B8",
    button: "#586D8C",
    calm: "#B7D7F0",
    sea: "#D6C7FF",
    bgRgb: "17 24 42",
    cardRgb: "27 36 56",
    inkRgb: "10 16 32",
    edgeRgb: "70 88 117",
    fgRgb: "248 251 255",
    dimRgb: "205 216 234",
    faintRgb: "145 161 184",
    buttonRgb: "88 109 140",
    calmRgb: "183 215 240",
    seaRgb: "214 199 255",
    unlockType: "seasonal",
  },
  {
    key: "northern",
    label: "Aurora Valley",
    emoji: "aurora",
    icon: "aurora",
    feeling: "Wonder, awe, inspiration",
    description:
      "Watch colorful auroras dance across the night sky while reflecting on life's beauty and endless possibilities.",
    artwork: "/sanctuary/northern_lights.PNG",
    ambient: ["Aurora animation", "Stars", "Water reflections", "Light shimmer"],
    palette: ["Aurora Green", "Emerald", "Violet", "Midnight Blue", "Indigo"],
    free: false,
    bg: "#061329",
    card: "#0E2136",
    ink: "#050C1A",
    edge: "#31526C",
    fg: "#F2FCFF",
    dim: "#B9D9E3",
    faint: "#7897A8",
    button: "#236C6E",
    calm: "#6EE7B7",
    sea: "#B879FF",
    bgRgb: "6 19 41",
    cardRgb: "14 33 54",
    inkRgb: "5 12 26",
    edgeRgb: "49 82 108",
    fgRgb: "242 252 255",
    dimRgb: "185 217 227",
    faintRgb: "120 151 168",
    buttonRgb: "35 108 110",
    calmRgb: "110 231 183",
    seaRgb: "184 121 255",
    unlockType: "plus",
  },
  {
    key: "cloud",
    label: "Cloud Sanctuary",
    emoji: "cloud",
    icon: "cloud",
    feeling: "Lightness, imagination, perspective",
    description:
      "A soft sanctuary above the clouds where reflection feels spacious, gentle, and open.",
    artwork: "/sanctuary/cloud_sanctuary.PNG",
    ambient: ["Slow clouds", "Soft light", "Drifting mist", "Warm horizon"],
    palette: ["Cloud Pink", "Lavender", "Peach", "Soft Violet", "Warm Gold"],
    free: false,
    bg: "#1B162B",
    card: "#28213A",
    ink: "#120F1E",
    edge: "#5B4D77",
    fg: "#FFF8FF",
    dim: "#E2D0E8",
    faint: "#A99AB8",
    button: "#8265A8",
    calm: "#D7B8FF",
    sea: "#F1B88B",
    bgRgb: "27 22 43",
    cardRgb: "40 33 58",
    inkRgb: "18 15 30",
    edgeRgb: "91 77 119",
    fgRgb: "255 248 255",
    dimRgb: "226 208 232",
    faintRgb: "169 154 184",
    buttonRgb: "130 101 168",
    calmRgb: "215 184 255",
    seaRgb: "241 184 139",
    unlockType: "plus",
  },
];

export function themeByKey(key: string): Theme {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}

export function themeUnlockLabel(theme: Theme) {
  if (theme.unlockType === "plus") return "Tranqly Plus";
  if (theme.unlockType === "seasonal") return "Seasonal theme";
  return `Unlocks at ${theme.unlockReflections ?? 0} reflection days`;
}

export function isThemeUnlocked(theme: Theme, reflectionCount: number, premium = false) {
  if (theme.unlockType === "plus") return premium;
  if (theme.unlockType === "seasonal") return false;
  return reflectionCount >= (theme.unlockReflections ?? 0);
}

export function themeUnlockRequirement(theme: Theme) {
  return theme.unlockReflections ?? 0;
}

export function themesByUnlockOrder() {
  return [...THEMES].sort((a, b) => {
    const aRank = a.unlockType === "reflections" ? 0 : a.unlockType === "plus" ? 1 : 2;
    const bRank = b.unlockType === "reflections" ? 0 : b.unlockType === "plus" ? 1 : 2;
    if (aRank !== bRank) return aRank - bRank;
    return (a.unlockReflections ?? 999) - (b.unlockReflections ?? 999);
  });
}

export function applyTheme(key: string) {
  const t = themeByKey(key);
  const root = document.documentElement;
  root.style.setProperty("--calm", t.calm);
  root.style.setProperty("--sea", t.sea);
  root.style.setProperty("--app-bg", t.bg);
  root.style.setProperty("--card", t.card);
  root.style.setProperty("--ink", t.ink);
  root.style.setProperty("--edge", t.edge);
  root.style.setProperty("--fg", t.fg);
  root.style.setProperty("--dim", t.dim);
  root.style.setProperty("--faint", t.faint);
  root.style.setProperty("--button", t.button);
  root.style.setProperty("--calm-rgb", t.calmRgb);
  root.style.setProperty("--sea-rgb", t.seaRgb);
  root.style.setProperty("--app-bg-rgb", t.bgRgb);
  root.style.setProperty("--card-rgb", t.cardRgb);
  root.style.setProperty("--ink-rgb", t.inkRgb);
  root.style.setProperty("--edge-rgb", t.edgeRgb);
  root.style.setProperty("--fg-rgb", t.fgRgb);
  root.style.setProperty("--dim-rgb", t.dimRgb);
  root.style.setProperty("--faint-rgb", t.faintRgb);
  root.style.setProperty("--button-rgb", t.buttonRgb);
}

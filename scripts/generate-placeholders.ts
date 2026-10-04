/**
 * Generates the SVG placeholder art shipped in `public/placeholders/`.
 *
 * The client has not supplied photography yet, so rather than ship broken
 * <img> tags we render brand-consistent vector scenes. Every one of them is
 * replaced the moment the owner uploads a real photo from the dashboard.
 *
 * Run: npx tsx scripts/generate-placeholders.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "placeholders");
mkdirSync(OUT, { recursive: true });

type Palette = { from: string; via: string; to: string; glow: string };
const PURPLE_GOLD: Palette = {
  from: "#2A1447",
  via: "#4B2A7B",
  to: "#8A5FB8",
  glow: "#D9A441",
};
const SAND: Palette = {
  from: "#FDFBF7",
  via: "#F3EBDD",
  to: "#E4D6F2",
  glow: "#D9A441",
};
const SAGE: Palette = {
  from: "#2A1447",
  via: "#3A1F60",
  to: "#5E8530",
  glow: "#A8C46A",
};

function defs(id: string, p: Palette) {
  return `<defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.from}"/>
      <stop offset="52%" stop-color="${p.via}"/>
      <stop offset="100%" stop-color="${p.to}"/>
    </linearGradient>
    <radialGradient id="sun-${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFF3D6"/>
      <stop offset="45%" stop-color="${p.glow}"/>
      <stop offset="100%" stop-color="${p.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fade-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.45"/>
    </linearGradient>
    <pattern id="dots-${id}" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="#ffffff" fill-opacity="0.14"/>
    </pattern>
  </defs>`;
}

/** Decorative corner glow + dot grid, shared by every scene. */
function ambience(id: string, w: number, h: number) {
  return `<rect width="${w}" height="${h}" fill="url(#dots-${id})"/>
  <circle cx="${w * 0.82}" cy="${h * 0.18}" r="${h * 0.42}" fill="#ffffff" opacity="0.05"/>
  <circle cx="${w * 0.12}" cy="${h * 0.86}" r="${h * 0.34}" fill="${"currentColor"}" opacity="0.05"/>`;
}

// ── 1. Hero: a person sitting on a rock facing the sunrise ──
const hero = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" role="img" aria-label="شخص جالس على صخرة يواجه شروق الشمس">
  ${defs("h", PURPLE_GOLD)}
  <rect width="1200" height="900" fill="url(#bg-h)"/>
  ${ambience("h", 1200, 900)}

  <!-- horizon glow -->
  <ellipse cx="600" cy="640" rx="620" ry="300" fill="url(#sun-h)" opacity="0.55"/>
  <circle cx="600" cy="612" r="96" fill="#FFF6E2" opacity="0.92"/>
  <circle cx="600" cy="612" r="150" fill="url(#sun-h)" opacity="0.5"/>

  <!-- distant ridge lines -->
  <path d="M0 700 L190 596 L320 660 L470 566 L640 668 L820 588 L1000 662 L1200 592 L1200 900 L0 900Z" fill="#2A1447" opacity="0.45"/>
  <path d="M0 762 L160 690 L330 748 L510 678 L700 754 L880 692 L1060 750 L1200 700 L1200 900 L0 900Z" fill="#1E0F36" opacity="0.6"/>

  <!-- foreground rock -->
  <path d="M300 900 C330 828 402 800 470 796 C556 790 636 812 690 846 C740 878 772 890 800 900Z" fill="#150A26"/>

  <!-- seated figure, back to us -->
  <g fill="#150A26">
    <circle cx="536" cy="612" r="34"/>
    <path d="M508 646 C498 700 500 742 512 772 L560 772 C572 738 574 698 564 646Z"/>
    <path d="M512 764 C496 800 470 826 442 838 L470 866 C508 854 538 828 552 796Z"/>
    <path d="M562 764 C578 798 604 822 634 834 L608 862 C570 850 540 824 526 794Z"/>
  </g>

  <rect width="1200" height="900" fill="url(#fade-h)"/>
</svg>`;

// ── 2. About: a calm, welcoming interior ──
const about = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="منطقة استقبال هادئة في المركز">
  ${defs("a", SAND)}
  <rect width="1200" height="800" fill="url(#bg-a)"/>
  <rect width="1200" height="800" fill="#FFFFFF" opacity="0.5"/>

  <!-- wall art -->
  <rect x="120" y="120" width="300" height="300" rx="28" fill="#FFFFFF" opacity="0.75"/>
  <circle cx="270" cy="230" r="66" fill="none" stroke="#D9A441" stroke-width="10"/>
  <path d="M270 300 L270 200 M270 250 L215 210 M270 250 L325 205" stroke="#4B2A7B" stroke-width="10" stroke-linecap="round"/>

  <!-- sofa -->
  <rect x="520" y="470" width="520" height="180" rx="40" fill="#4B2A7B"/>
  <rect x="540" y="380" width="480" height="120" rx="34" fill="#6B3FA0"/>
  <rect x="520" y="620" width="60" height="34" rx="12" fill="#3A1F60"/>
  <rect x="980" y="620" width="60" height="34" rx="12" fill="#3A1F60"/>

  <!-- armchairs -->
  <rect x="120" y="500" width="220" height="150" rx="34" fill="#7BA33F"/>
  <rect x="135" y="430" width="190" height="90" rx="28" fill="#5E8530"/>
  <rect x="135" y="640" width="42" height="26" rx="10" fill="#4B2A7B"/>
  <rect x="285" y="640" width="42" height="26" rx="10" fill="#4B2A7B"/>

  <!-- plant -->
  <path d="M1040 654 C1030 590 1044 540 1064 512 C1074 552 1072 604 1064 654Z" fill="#5E8530"/>
  <path d="M1064 654 C1078 596 1108 560 1140 550 C1122 596 1096 636 1064 654Z" fill="#7BA33F"/>
  <rect x="1014" y="650" width="100" height="58" rx="16" fill="#4B2A7B"/>

  <!-- rug -->
  <ellipse cx="600" cy="742" rx="440" ry="40" fill="#4B2A7B" opacity="0.08"/>
</svg>`;

// ── 3. Vision 2030: growth and horizon ──
const vision = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="نمو وتوسّع الأثر">
  ${defs("v", SAGE)}
  <rect width="1200" height="800" fill="url(#bg-v)"/>
  <circle cx="600" cy="240" r="180" fill="url(#sun-v)" opacity="0.35"/>
  <circle cx="600" cy="240" r="86" fill="#FFF6E2" opacity="0.85"/>

  <!-- growth bars -->
  <g fill="#A8C46A" opacity="0.85">
    <rect x="300" y="520" width="90" height="200" rx="18"/>
    <rect x="430" y="452" width="90" height="268" rx="18"/>
    <rect x="560" y="380" width="90" height="340" rx="18"/>
    <rect x="690" y="300" width="90" height="420" rx="18"/>
    <rect x="820" y="220" width="90" height="500" rx="18" opacity="0.6"/>
  </g>

  <!-- tree growing out of the last bar -->
  <path d="M865 220 C858 168 862 132 872 106 C880 138 878 176 872 220Z" fill="#2A1447" opacity="0.7"/>
  <g fill="#D9A441" opacity="0.9">
    <circle cx="872" cy="88" r="20"/>
    <circle cx="840" cy="112" r="15"/>
    <circle cx="906" cy="110" r="15"/>
  </g>
  <rect width="1200" height="800" fill="url(#dots-v)"/>
</svg>`;

// ── 4. Closing CTA: two hands, support ──
const cta = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" width="1200" height="700" role="img" aria-label="دعم ومساندة">
  ${defs("c", PURPLE_GOLD)}
  <rect width="1200" height="700" fill="url(#bg-c)"/>
  <circle cx="1000" cy="120" r="220" fill="#ffffff" opacity="0.05"/>
  <circle cx="200" cy="600" r="180" fill="${PURPLE_GOLD.glow}" opacity="0.12"/>

  <!-- two cupped hands -->
  <path d="M180 430 C300 350 460 340 600 372 C740 404 900 402 1020 356 C1000 470 880 552 700 566 C500 582 300 546 180 430Z" fill="#FFFFFF" opacity="0.16"/>
  <path d="M180 430 C300 350 460 340 600 372 C740 404 900 402 1020 356" fill="none" stroke="${PURPLE_GOLD.glow}" stroke-width="7" stroke-linecap="round" opacity="0.8"/>

  <!-- small tree rising from the palms -->
  <path d="M596 372 C590 330 594 302 600 282 C606 306 604 338 600 372Z" fill="#D9A441" opacity="0.9"/>
  <g fill="#A8C46A" opacity="0.92">
    <circle cx="600" cy="266" r="24"/>
    <circle cx="566" cy="292" r="17"/>
    <circle cx="634" cy="290" r="17"/>
    <circle cx="582" cy="316" r="13"/>
    <circle cx="618" cy="314" r="13"/>
  </g>
  <rect width="1200" height="700" fill="url(#fade-c)"/>
</svg>`;

// ── 5–7. Blog covers: abstract editorial art ──
function blogCover(
  id: string,
  palette: Palette,
  motif: "steps" | "hands" | "moon",
): string {
  const art =
    motif === "steps"
      ? `<g opacity="0.9">
           <rect x="180" y="480" width="180" height="120" rx="20" fill="#FFFFFF" opacity="0.22"/>
           <rect x="380" y="400" width="180" height="200" rx="20" fill="#FFFFFF" opacity="0.32"/>
           <rect x="580" y="310" width="180" height="290" rx="20" fill="#FFFFFF" opacity="0.44"/>
           <rect x="780" y="210" width="180" height="390" rx="20" fill="${palette.glow}" opacity="0.85"/>
           <path d="M870 150 L886 190 L926 206 L886 222 L870 262 L854 222 L814 206 L854 190Z" fill="#FFF6E2"/>
         </g>`
      : motif === "hands"
        ? `<g opacity="0.92">
             <path d="M300 470 C400 400 540 392 660 420 C780 448 900 446 1000 408 C984 512 880 578 720 590 C540 602 380 566 300 470Z" fill="#FFFFFF" opacity="0.24"/>
             <circle cx="700" cy="240" r="70" fill="${palette.glow}" opacity="0.9"/>
             <circle cx="820" cy="300" r="40" fill="#FFF6E2" opacity="0.75"/>
           </g>`
        : `<g opacity="0.92">
             <path d="M880 140 A170 170 0 1 0 880 480 A140 140 0 1 1 880 140Z" fill="${palette.glow}" opacity="0.9"/>
             <circle cx="470" cy="240" r="46" fill="#FFF6E2" opacity="0.85"/>
             <path d="M250 600 C330 540 430 530 530 556 C630 582 730 580 810 548" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" opacity="0.4"/>
             <path d="M250 660 C330 600 430 590 530 616 C630 642 730 640 810 608" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" opacity="0.25"/>
           </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img">
  ${defs(id, palette)}
  <rect width="1200" height="800" fill="url(#bg-${id})"/>
  ${art}
  <rect width="1200" height="800" fill="url(#dots-${id})"/>
</svg>`;
}

const files: Record<string, string> = {
  "hero-sunrise.svg": hero,
  "about-center.svg": about,
  "vision2030.svg": vision,
  "cta-hands.svg": cta,
  "blog-1.svg": blogCover("b1", PURPLE_GOLD, "steps"),
  "blog-2.svg": blogCover("b2", SAND, "hands"),
  "blog-3.svg": blogCover("b3", PURPLE_GOLD, "moon"),
  // Fallback used when a content item has no cover image.
  "cover-fallback.svg": blogCover("cf", PURPLE_GOLD, "steps"),
  "service-fallback.svg": blogCover("sf", SAND, "hands"),
};

for (const [name, svg] of Object.entries(files)) {
  writeFileSync(join(OUT, name), svg.trim() + "\n", "utf8");
}

// ── Favicon: the golden ring + tree, standalone ──
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="g" x1="20" y1="180" x2="180" y2="20">
      <stop offset="0%" stop-color="#F2C46A"/><stop offset="50%" stop-color="#D9A441"/><stop offset="100%" stop-color="#B98529"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="44" fill="#4B2A7B"/>
  <circle cx="100" cy="100" r="72" stroke="url(#g)" stroke-width="9" fill="none" stroke-dasharray="410 42" stroke-linecap="round" transform="rotate(-38 100 100)"/>
  <path d="M100 158 C100 128 103 108 108 92 C111 82 102 79 97 72 C92 66 93 60 98 60 C104 60 107 65 108 71 C109 59 112 50 115 50 C118 50 121 59 122 71 C123 65 126 60 132 60 C137 60 138 66 133 72 C128 79 119 82 122 92 C127 108 130 128 130 158Z" fill="#A8C46A"/>
  <path d="M150 62 L153 71 L162 74 L153 77 L150 86 L147 77 L138 74 L147 71Z" fill="#D9A441"/>
</svg>`;
writeFileSync(join(process.cwd(), "public", "icon.svg"), favicon.trim() + "\n", "utf8");
writeFileSync(join(process.cwd(), "public", "favicon.svg"), favicon.trim() + "\n", "utf8");

console.log(`✓ generated ${Object.keys(files).length} placeholders + favicon`);

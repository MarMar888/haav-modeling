// What a visitor can tell us they want to help with on the sponsor form.
export const INTERESTS = ["Funds", "Parts", "Skills", "Not sure yet"] as const;

// Current sponsors shown on the home page, one per row. Logos live in public/ (SVGs are rendered unoptimized by the page).
// `width` (px) sets a logo's size explicitly, for one that looks too small or too large at the default (up to 288 px wide, 96 px tall).
export type Sponsor = { name: string; url: string; width?: number; logo: { src: string; width: number; height: number } };

export const SPONSORS: readonly Sponsor[] = [
  { name: "TotalBoat", url: "https://www.totalboat.com", width: 306, logo: { src: "/totalboat-logo.svg", width: 189, height: 71 } },
  {
    name: "Fincantieri Marine Group",
    url: "https://www.fincantierimarinegroup.com",
    logo: { src: "/fincantieri-marine-group-logo.png", width: 2100, height: 440 },
  },
  {
    name: "Grainger Engineering Design Innovation Laboratory",
    url: "https://making.engr.wisc.edu",
    logo: { src: "/grainger-edil-logo.png", width: 1083, height: 218 },
  },
  {
    name: "Hoofers Sailing Club",
    url: "https://www.hoofers.org/",
    width: 448,
    logo: { src: "/hoofers-sailing-club-logo.png", width: 395, height: 100 },
  },
];

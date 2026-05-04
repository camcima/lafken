// Shared Tailwind class strings for native <select> elements.
// The chevron background image lives in `index.css` as a `.select-chevron`
// utility because Tailwind v4 cannot parse arbitrary classes containing
// data: URLs with nested quotes — the design's inline form works only with
// Tailwind v3 / play CDN.

/** Standard filter/form select — h-9 height, 12.5px font. */
export const SELECT_CLASS = [
  "h-9",
  "appearance-none",
  "rounded-md",
  "border",
  "border-input",
  "bg-card",
  "pl-3",
  "pr-8",
  "text-[12.5px]",
  "select-chevron",
  "select-chevron-md",
].join(" ");

/** Compact paginator select — h-7 height, 12px font. */
export const SELECT_CLASS_SM = [
  "h-7",
  "leading-none",
  "appearance-none",
  "rounded",
  "border",
  "border-input",
  "bg-card",
  "pl-2",
  "pr-7",
  "text-[12px]",
  "select-chevron",
  "select-chevron-sm",
].join(" ");

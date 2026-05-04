// Shared Tailwind class strings for native <select> elements.
// Includes an inline SVG chevron background so the down-arrow renders
// consistently across browsers (appearance-none removes the native arrow).

const CHEVRON_SVG =
  "bg-[image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%221.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M4 6l4 4 4-4%22/></svg>')]";

/** Standard filter/form select — h-8 height, 12.5px font. */
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
  "bg-no-repeat",
  "bg-[right_0.5rem_center]",
  "bg-[length:14px_14px]",
  CHEVRON_SVG,
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
  "bg-no-repeat",
  "bg-[right_0.4rem_center]",
  "bg-[length:12px_12px]",
  CHEVRON_SVG,
].join(" ");

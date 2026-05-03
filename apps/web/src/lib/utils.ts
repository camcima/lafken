import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BYTES_IN_KB = 1024;
const BYTES_IN_MB = 1_048_576;

export function fmtBytes(bytes: number): string {
  if (bytes < BYTES_IN_KB) return `${String(bytes)} B`;
  if (bytes < BYTES_IN_MB) return `${(bytes / BYTES_IN_KB).toFixed(1)} KB`;
  return `${(bytes / BYTES_IN_MB).toFixed(2)} MB`;
}

export function fmtNum(num: number): string {
  return num.toLocaleString();
}

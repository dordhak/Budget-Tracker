import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const myr = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });

export function formatMYR(value: number): string {
  return myr.format(value);
}

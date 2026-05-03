import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return price.toFixed(2);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1e7) {
    return `${(amount / 1e8).toFixed(2)}亿`;
  }
  if (abs >= 1e4) {
    return `${(amount / 1e4).toFixed(2)}万`;
  }
  return amount.toFixed(2);
}

export function getChangeColor(value: number): string {
  if (value > 0) return "text-trading-up";
  if (value < 0) return "text-trading-down";
  return "text-trading-neutral";
}

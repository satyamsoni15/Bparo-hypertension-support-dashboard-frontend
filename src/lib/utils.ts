import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Capitalizes the first letter of every word in a person's name without
// touching the rest (so already-correct casing like "McDonald" or "O'Brien"
// survives), for names that come back from the backend however the user
// originally typed them (e.g. all lowercase).
export function capitalizeName<T extends string | null | undefined>(name: T): T {
  if (!name) return name;
  return name.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) as T;
}

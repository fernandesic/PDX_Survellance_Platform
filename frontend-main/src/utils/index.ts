import { useEffect, useState } from "react"

export const validatePassword = (pwd: string) => {
  if (!pwd.trim()) return "Password is required"
  if (pwd.length < 8) return "Password must be at least 8 characters"
  return null
}

export const validateEmail = (email: string) => {
  if (!email.trim()) return "Email is required"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address"
  return null
}

export function formatDateTimeLocal(isoString: string): string {
  const date = new Date(isoString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function toSnakeCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
}


export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}


export function capitalize(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}


export function normalizeText(text: string): string {
  if (!text) return "";

  return text.replace(/\s+/g, "").toLowerCase();
}


export { getBrowserSessionId, clearBrowserSessionId, hasBrowserSessionId } from './session';
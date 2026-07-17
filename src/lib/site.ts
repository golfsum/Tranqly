export const SITE_URL = "https://tranqly.app";

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

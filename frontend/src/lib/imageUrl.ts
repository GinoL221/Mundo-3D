// Shared image-URL resolution rule, consumed by every `<img>` site (product
// cards, product detail, cart items, user avatar). An `image` value is
// either a newly-uploaded absolute bucket URL (design.md "Decision:
// resolveImageUrl") or a legacy bare filename from seed data — this
// function is the single place that decides which one it is.
//
// Deliberately matches on the http(s) scheme prefix rather than the R2
// public-URL-base host: this keeps the frontend free of a backend env var
// and survives a future storage-provider swap. Protocol-relative URLs
// (`//host/x`) and any non-http(s) scheme (e.g. `javascript:`) are NOT
// treated as absolute — they fall through to the legacy prefix branch. A
// broken image is the acceptable failure mode; an attacker-chosen scheme
// reaching an `<img src>` is not.
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

export function resolveImageUrl(
  image: string | null | undefined,
  kind: 'products' | 'users',
): string {
  if (!image || !image.trim()) return '';
  if (ABSOLUTE_URL_PATTERN.test(image)) return image;
  return `/img/${kind}/${image}`;
}

import { timingSafeEqual } from 'node:crypto';

export function hasSitePassword(value) {
  const expected = process.env.SITE_PASSWORD;
  if (!expected || typeof value !== 'string') return false;
  const suppliedBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function hasRequestSitePassword(request) {
  return hasSitePassword(request.headers.get('x-site-password'));
}

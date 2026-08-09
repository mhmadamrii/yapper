import { createDb } from '@yapper/db';
import { linkPreview } from '@yapper/db/schema/link-preview';
import { eq } from 'drizzle-orm';

type Db = ReturnType<typeof createDb>;

/** Give up on a slow origin rather than holding the request open. */
const FETCH_TIMEOUT_MS = 5_000;

/**
 * Metadata lives in `<head>`, so there is no reason to read a whole page.
 * This also bounds what a hostile server can make us buffer.
 */
const MAX_BYTES = 512 * 1024;

/** Redirect chains are followed by hand so every hop is re-validated. */
const MAX_REDIRECTS = 3;

/** How long a cached unfurl is trusted before a re-fetch. */
const OK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Failures are cached far more briefly — sites come back. */
const FAILED_TTL_MS = 60 * 60 * 1000;

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'igshid',
  'ref_src',
];

/**
 * Hostnames that must never be fetched. Cloudflare Workers cannot route to a
 * private network in the first place, but this code should not depend on the
 * runtime being the thing that saves it — the same helper run anywhere else
 * (a Node dev server, a future batch job) would otherwise be a straight SSRF.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'instance-data',
]);

const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.localhost', '.home.arpa']; // prettier-ignore

/** Only the standard web ports — no probing an intranet service on :8500. */
const ALLOWED_PORTS = new Set(['', '80', '443']);

function isPrivateIpv4(host: string) {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number(part));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = octets as [number, number, number, number];
  return (
    a === 0 || // "this network"
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    a >= 224 // multicast + reserved
  );
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '');

  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)))
    return true;
  // A bare hostname with no dot is intranet-only by definition.
  if (!host.includes('.') && !host.startsWith('[')) return true;
  if (isPrivateIpv4(host)) return true;

  // IPv6 literals arrive bracketed. Loopback / link-local / unique-local are
  // the equivalents of the v4 ranges above; anything else in literal form is
  // still suspicious enough to refuse, since real links use names.
  if (host.startsWith('[')) return true;

  return false;
}

/**
 * Validates and canonicalizes a user-supplied URL.
 *
 * Returns null for anything that must not be fetched or stored — a non-web
 * scheme, embedded credentials, a non-standard port, or a host that points
 * back inside the network. Canonicalization (lowercased host, no fragment, no
 * tracking params, no trailing `?`) is what lets the cache actually hit.
 */
export function normalizeUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  // `https://user:pass@host` — credential-stuffing a fetch we make on the
  // user's behalf.
  if (parsed.username || parsed.password) return null;
  if (!ALLOWED_PORTS.has(parsed.port)) return null;
  if (isBlockedHost(parsed.hostname)) return null;

  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  TRACKING_PARAMS.forEach((param) => parsed.searchParams.delete(param));

  let normalized = parsed.toString();
  if (normalized.endsWith('?')) normalized = normalized.slice(0, -1);
  return normalized.length > 2048 ? null : normalized;
}

/**
 * Fetches `url`, following redirects manually so that each hop is put back
 * through `normalizeUrl` — otherwise a public URL that 302s to
 * `http://169.254.169.254/` would sail straight through the checks above.
 *
 * Reads at most `MAX_BYTES` and only from an HTML response.
 */
async function fetchHtmlHead(url: string) {
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Some sites serve OG tags only to crawlers they recognise.
        'user-agent': 'YapperBot/1.0 (+link preview)',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      const next = normalizeUrl(new URL(location, current).toString());
      if (!next) return null;
      current = next;
      continue;
    }

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) return null;

    return { html: await readCapped(response), finalUrl: current };
  }

  return null;
}

/**
 * Reads the body chunk by chunk, stopping at `MAX_BYTES` or as soon as
 * `</head>` has been seen. `response.text()` would buffer whatever the server
 * decides to send, which is exactly the wrong behaviour for a URL a stranger
 * chose.
 */
async function readCapped(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let html = '';
  let bytes = 0;

  try {
    while (bytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (html.includes('</head>')) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return html;
}

function decodeEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Pulls one `<meta>` value. Attribute order is not fixed in the wild
 * (`content` before `property` is common), so both orderings are tried.
 */
function readMeta(html: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
        'i',
      ),
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(html);
      const value = match?.[1] && decodeEntities(match[1]);
      if (value) return value;
    }
  }
  return null;
}

function truncate(value: string | null, max: number) {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

type UnfurlResult = {
  status: 'ok' | 'failed';
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  domain: string;
};

async function unfurl(url: string): Promise<UnfurlResult> {
  const domain = new URL(url).hostname.replace(/^www\./, '');
  const failed: UnfurlResult = {
    status: 'failed',
    title: null,
    description: null,
    imageUrl: null,
    siteName: null,
    domain,
  };

  let fetched: Awaited<ReturnType<typeof fetchHtmlHead>>;
  try {
    fetched = await fetchHtmlHead(url);
  } catch {
    // Timeout, DNS failure, TLS error — all the same to the caller.
    return failed;
  }
  if (!fetched) return failed;

  const { html, finalUrl } = fetched;

  const title =
    readMeta(html, ['og:title', 'twitter:title']) ??
    decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '') ??
    null;

  const rawImage = readMeta(html, [
    'og:image:secure_url',
    'og:image:url',
    'og:image',
    'twitter:image',
  ]);

  // og:image is frequently a relative path; the card needs it absolute. It is
  // put through the same host checks as the page — the browser will load it,
  // so it must not be pointed at an intranet either.
  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      imageUrl = normalizeUrl(new URL(rawImage, finalUrl).toString());
    } catch {
      imageUrl = null;
    }
  }

  if (!title && !imageUrl) return failed;

  return {
    status: 'ok',
    title: truncate(title, 200),
    description: truncate(
      readMeta(html, ['og:description', 'twitter:description', 'description']),
      400,
    ),
    imageUrl,
    siteName: truncate(readMeta(html, ['og:site_name']), 100),
    domain,
  };
}

function isFresh(row: { status: string; fetchedAt: Date }) {
  const ttl = row.status === 'ok' ? OK_TTL_MS : FAILED_TTL_MS;
  return Date.now() - row.fetchedAt.getTime() < ttl;
}

/**
 * Cache-first unfurl. Returns the stored row, fetching only on a miss or once
 * the entry has gone stale.
 *
 * `url` must already be normalized — callers get it from `normalizeUrl`, which
 * is also the SSRF gate, so passing a raw user string here would skip it.
 */
export async function getOrCreateLinkPreview(db: Db, url: string) {
  const [cached] = await db
    .select()
    .from(linkPreview)
    .where(eq(linkPreview.url, url))
    .limit(1);

  if (cached && isFresh(cached)) return cached;

  const result = await unfurl(url);
  const values = { url, ...result, fetchedAt: new Date() };

  const [row] = await db
    .insert(linkPreview)
    .values(values)
    .onConflictDoUpdate({ target: linkPreview.url, set: values })
    .returning();

  return row ?? { ...values };
}

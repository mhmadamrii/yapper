const APP_NAME = 'Yapper';
const SITE_URL = 'https://yappers.online';
const DEFAULT_DESCRIPTION =
  'Yapper is a fast, no-nonsense social feed — post, follow, and yap in real time. Built in the spirit of X and Bluesky.';
const DEFAULT_IMAGE = `${SITE_URL}/opengraph-image.jpeg`;
const DEFAULT_KEYWORDS =
  'yapper, social media, microblogging, X alternative, Bluesky alternative, social feed, real-time posts';

export const seo = ({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  image = DEFAULT_IMAGE,
}: {
  title?: string;
  description?: string;
  image?: string;
  keywords?: string;
}) => {
  // Bluesky-style tab title: "Discover — Yapper" on sub-pages, just the app
  // name (plus a tagline, for the bare document title) on the root page.
  const pageTitle = title
    ? `${title} — ${APP_NAME}`
    : `${APP_NAME} — social, unfiltered`;

  return [
    { title: pageTitle },
    { name: 'description', content: description },
    { name: 'keywords', content: keywords },
    // Every route here is public content (no private-account concept, no
    // per-user robots exceptions) — fine to let crawlers index everything.
    { name: 'robots', content: 'index, follow' },

    // Twitter Card — spec uses `name`, not `property`.
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: pageTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },

    // Open Graph — spec requires `property`, not `name`. Facebook/LinkedIn
    // scrapers only read `property="og:*"`; the previous version of this
    // file used `name` here, which they silently ignore.
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: APP_NAME },
    { property: 'og:title', content: pageTitle },
    { property: 'og:description', content: description },
    // Not per-route (would need every `seo({...})` call site to pass a
    // path) — the site root is a reasonable stand-in until that's worth it.
    { property: 'og:url', content: SITE_URL },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: `${APP_NAME} — social, unfiltered` },
  ];
};

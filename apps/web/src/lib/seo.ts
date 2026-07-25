const APP_NAME = 'Yapper';

export const seo = ({
  title,
  description,
  keywords,
  image,
}: {
  title?: string;
  description?: string;
  image?: string;
  keywords?: string;
}) => {
  // Bluesky-style tab title: "Discover — Bluesky" on sub-pages, just the
  // app name on the root page.
  const pageTitle = title ? `${title} — ${APP_NAME}` : APP_NAME;

  const tags = [
    { title: pageTitle },
    { name: 'description', content: description },
    { name: 'keywords', content: keywords },
    { name: 'twitter:title', content: pageTitle },
    { name: 'twitter:description', content: description },
    { name: 'og:type', content: 'website' },
    { name: 'og:title', content: pageTitle },
    { name: 'og:description', content: description },
    ...(image
      ? [
          { name: 'twitter:image', content: image },
          { name: 'twitter:card', content: 'summary_large_image' },
          { name: 'og:image', content: image },
        ]
      : []),
  ];

  return tags;
};

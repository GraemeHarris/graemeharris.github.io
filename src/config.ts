import type { Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://graemeharris.github.io/",
  author: "Graeme Harris",
  desc: "Stubbing my toe against reality",
  title: "Grey Blog",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerPage: 3,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
};

export const LOCALE = {
  lang: "en", // html lang code. Set this empty and default will be "en"
  langTag: ["en-EN"], // BCP 47 Language Tags. Set this empty [] to use the environment default
} as const;

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/GraemeHarris",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:harris[dot]graemeza[at]gmail[dot]com",
    linkTitle: `Send an email to ${SITE.title}`,
    active: true,
  },
  {
    name: "Twitter",
    href: "https://x.com/GesturingMan",
    linkTitle: `${SITE.title} on Twitter`,
    active: true,
  },
  {
    name: "BlueSky",
    href: "https://bsky.app/profile/graemeharris.bsky.social",
    linkTitle: `${SITE.title} on BlueSky`,
    active: true,
  },
];

import { injectContentFiles } from '@analogjs/content';

export interface SiteSettings {
  title: string;
  tagline: string;
  logo?: string;
  logoDark?: string;
  logoFull?: string;
  logoFullDark?: string;
  socialLinks?: { platform: string; url: string }[];
}

export function injectSiteSettings(): SiteSettings | undefined {
  return injectContentFiles<SiteSettings>((file) =>
    file.filename.includes('/settings.md'),
  )[0]?.attributes;
}

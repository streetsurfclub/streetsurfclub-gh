import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { injectContentFiles } from '@analogjs/content';
import { injectSiteSettings } from './site-settings';
import { PageAttributes } from './page.model';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="site-header">
      <nav class="site-nav container">
        <a routerLink="/" class="brand">{{ settings?.title ?? 'StreetSurfClub' }}</a>
        <ul class="nav-links">
          <li>
            <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="active">Home</a>
          </li>
          <li><a routerLink="/about" routerLinkActive="active">About</a></li>
          @for (page of pages; track page.attributes.slug) {
            <li>
              <a [routerLink]="['/page', page.attributes.slug]" routerLinkActive="active">{{ page.attributes.title }}</a>
            </li>
          }
        </ul>
        <button
          class="menu-btn"
          popovertarget="mobile-nav"
          popovertargetaction="show"
          aria-label="Open navigation"
        >
          &#9776;
        </button>
      </nav>
    </header>
    <nav id="mobile-nav" popover aria-label="Mobile navigation">
      <ul>
        <li>
          <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="active"
             popovertarget="mobile-nav" popovertargetaction="hide"
             (click)="closeMenu()">Home</a>
        </li>
        <li>
          <a routerLink="/about" routerLinkActive="active"
             popovertarget="mobile-nav" popovertargetaction="hide"
             (click)="closeMenu()">About</a>
        </li>
        @for (page of pages; track page.attributes.slug) {
          <li>
            <a [routerLink]="['/page', page.attributes.slug]" routerLinkActive="active"
               popovertarget="mobile-nav" popovertargetaction="hide"
               (click)="closeMenu()">{{ page.attributes.title }}</a>
          </li>
        }
      </ul>
    </nav>
    <main>
      <router-outlet />
    </main>
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <a routerLink="/" class="brand">{{ settings?.title ?? 'StreetSurfClub' }}</a>
            <p>{{ settings?.tagline }}</p>
          </div>
          @if (settings?.socialLinks?.length) {
            <div>
              <h2>Follow</h2>
              <ul class="social-links">
                @for (link of settings?.socialLinks; track link.url) {
                  <li>
                    <a [href]="link.url" target="_blank" rel="noopener">{{ link.platform }}</a>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
        <p class="copyright">&copy; {{ year }} {{ settings?.title ?? 'StreetSurfClub' }}</p>
      </div>
    </footer>
  `,
})
export class App {
  readonly settings = injectSiteSettings();
  readonly year = new Date().getFullYear();
  readonly pages = injectContentFiles<PageAttributes>((file) =>
    file.filename.includes('src/content/pages/'),
  ).sort((a, b) => a.attributes.title.localeCompare(b.attributes.title));

  closeMenu() {
    document.getElementById('mobile-nav')?.hidePopover?.();
  }
}

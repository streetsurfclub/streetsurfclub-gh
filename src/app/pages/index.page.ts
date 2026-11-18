import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { injectContentFiles } from '@analogjs/content';

import { PostAttributes } from '../post.model';
import { PageAttributes } from '../page.model';
import { injectSiteSettings } from '../site-settings';
import { PostList, POSTS_PER_PAGE } from '../post-list';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe, PostList],
  template: `
    <header class="hero">
      <div class="container">
        <h1>{{ settings?.title ?? 'StreetSurfClub' }}</h1>
        <p>{{ settings?.tagline }}</p>
      </div>
    </header>

    <section class="section">
      <div class="container">
        <app-post-list [posts]="posts" [page]="1" [totalPages]="totalPages" />

        @if (pages.length) {
          <h2 class="section-title">Pages</h2>
          <ul class="post-list">
            @for (page of pages; track page.attributes.slug) {
              <li class="post-card">
                <a [routerLink]="['/page', page.attributes.slug]">
                  <div class="post-card-body">
                    <h2>{{ page.attributes.title }}</h2>
                    @if (page.attributes.description) {
                      <p>{{ page.attributes.description }}</p>
                    }
                  </div>
                </a>
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
})
export default class HomePage {
  readonly settings = injectSiteSettings();
  readonly pages = injectContentFiles<PageAttributes>((file) =>
    file.filename.includes('src/content/pages/'),
  ).sort((a, b) => a.attributes.title.localeCompare(b.attributes.title));
  readonly allPosts = injectContentFiles<PostAttributes>((file) =>
    file.filename.includes('src/content/blog/'),
  ).sort(
    (a, b) =>
      new Date(b.attributes.publishedAt).getTime() -
      new Date(a.attributes.publishedAt).getTime(),
  );
  readonly posts = this.allPosts.slice(0, POSTS_PER_PAGE);
  readonly totalPages = Math.max(1, Math.ceil(this.allPosts.length / POSTS_PER_PAGE));
}

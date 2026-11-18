import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { injectContentFiles } from '@analogjs/content';

import { PostAttributes } from '../post.model';
import { PageAttributes } from '../page.model';
import { injectSiteSettings } from '../site-settings';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe],
  template: `
    <header class="hero">
      <div class="container">
        <h1>{{ settings?.title ?? 'StreetSurfClub' }}</h1>
        <p>{{ settings?.tagline }}</p>
      </div>
    </header>

    <section class="section">
      <div class="container">
        <ul class="post-list">
          @for (post of posts; track post.attributes.slug) {
            <li class="post-card">
              <a [routerLink]="['/blog', post.attributes.slug]">
                @if (post.attributes.coverImage) {
                  <img [src]="post.attributes.coverImage" [alt]="post.attributes.title" />
                }
                <div class="post-card-body">
                  <h2>{{ post.attributes.title }}</h2>
                  <p class="meta">
                    <time [attr.datetime]="post.attributes.publishedAt">{{ post.attributes.publishedAt | date: 'mediumDate' }}</time>
                  </p>
                  <p>{{ post.attributes.description }}</p>
                  <ul class="tags">
                    @for (tag of post.attributes.tags; track tag) {
                      <li>#{{ tag }}</li>
                    }
                  </ul>
                </div>
              </a>
            </li>
          } @empty {
            <li>No posts yet.</li>
          }
        </ul>

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
  readonly posts = injectContentFiles<PostAttributes>((file) =>
    file.filename.includes('src/content/blog/'),
  ).sort(
    (a, b) =>
      new Date(b.attributes.publishedAt).getTime() -
      new Date(a.attributes.publishedAt).getTime(),
  );
}

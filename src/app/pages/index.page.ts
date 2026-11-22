import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { injectContentFiles } from '@analogjs/content';

import { PostAttributes } from '../post.model';
import { PageAttributes } from '../page.model';
import { injectSiteSettings } from '../site-settings';
import { PostList, POSTS_PER_PAGE } from '../post-list';
import { PostSearch, filterPostsByQuery, filterPostsByTag } from '../post-search';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe, PostList, PostSearch],
  template: `
    <header class="hero">
      <div class="container">
        <h1>{{ settings?.title ?? 'StreetSurfClub' }}</h1>
        <p>{{ settings?.tagline }}</p>
      </div>
    </header>

    <section class="section">
      <div class="container">
        <app-post-search />
        @if (results(); as results) {
          <p class="search-info">
            @if (tag(); as tag) {
              Posts tagged <strong>#{{ tag }}</strong>
            } @else {
              {{ results.length }} result{{ results.length === 1 ? '' : 's' }} for
              &ldquo;{{ query() }}&rdquo;
            }
            &mdash; <a [routerLink]="[]" [queryParams]="{ tag: null, q: null }">reset</a>
          </p>
        }
        <app-post-list [posts]="posts()" [page]="1" [totalPages]="totalPages()" />

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
  private readonly route = inject(ActivatedRoute);
  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
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
  readonly query = computed(() => (this.queryParamMap().get('q') ?? '').trim());
  readonly tag = computed(() => (this.queryParamMap().get('tag') ?? '').trim());
  /** null = no active filter → normal latest-posts view. */
  readonly results = computed(() => {
    let r = this.allPosts;
    const t = this.tag();
    const q = this.query();
    if (t) r = filterPostsByTag(r, t);
    if (q) r = filterPostsByQuery(r, q);
    return t || q ? r : null;
  });
  readonly posts = computed(
    () => this.results() ?? this.allPosts.slice(0, POSTS_PER_PAGE),
  );
  readonly totalPages = computed(() =>
    this.results()
      ? 1
      : Math.max(1, Math.ceil(this.allPosts.length / POSTS_PER_PAGE)),
  );
}

import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { injectContentFiles } from '@analogjs/content';
import { RouteMeta } from '@analogjs/router';

import { PostAttributes } from '../post.model';
import { PostList, POSTS_PER_PAGE } from '../post-list';
import { PostSearch, filterPostsByQuery, filterPostsByTag } from '../post-search';

export const routeMeta: RouteMeta = {
  title: 'Posts',
};

@Component({
  selector: 'app-posts-page',
  imports: [RouterLink, PostList, PostSearch],
  template: `
    <section class="section">
      <div class="container">
        <h1>Posts{{ page() > 1 ? ' — page ' + page() : '' }}</h1>
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
        <app-post-list [posts]="posts()" [page]="effectivePage()" [totalPages]="totalPages()" />
      </div>
    </section>
  `,
})
export default class PostsPage {
  private readonly route = inject(ActivatedRoute);
  // Reactive: route.snapshot would be stale when navigating /posts/2 → /posts/3
  // (Angular reuses the component for the same route config).
  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly page = computed(() => Number(this.paramMap().get('page')) || 1);
  readonly allPosts = injectContentFiles<PostAttributes>((file) =>
    file.filename.includes('src/content/blog/'),
  ).sort(
    (a, b) =>
      new Date(b.attributes.publishedAt).getTime() -
      new Date(a.attributes.publishedAt).getTime(),
  );
  readonly query = computed(() => (this.queryParamMap().get('q') ?? '').trim());
  readonly tag = computed(() => (this.queryParamMap().get('tag') ?? '').trim());
  /** null = no active filter → normal paginated view. */
  readonly results = computed(() => {
    let r = this.allPosts;
    const t = this.tag();
    const q = this.query();
    if (t) r = filterPostsByTag(r, t);
    if (q) r = filterPostsByQuery(r, q);
    return t || q ? r : null;
  });
  readonly totalPages = computed(() =>
    this.results()
      ? 1
      : Math.max(1, Math.ceil(this.allPosts.length / POSTS_PER_PAGE)),
  );
  readonly posts = computed(() =>
    this.results() ??
    this.allPosts.slice(
      (this.page() - 1) * POSTS_PER_PAGE,
      this.page() * POSTS_PER_PAGE,
    ),
  );
  /** During an active filter the page param is irrelevant — show page 1. */
  readonly effectivePage = computed(() => (this.results() ? 1 : this.page()));
}

import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ContentFile } from '@analogjs/content';

import { PostAttributes } from './post.model';

/**
 * Client-side filters over all bundled posts. All md files are in the JS
 * bundle, so this works on the fully prerendered site — no server needed.
 * Filters live in query params (`?q=` free text, `?tag=` exact tag), so
 * result URLs are shareable and prerender-safe (query params don't affect
 * static file serving and never 404 on GitHub Pages).
 */
export function filterPostsByQuery(
  posts: ContentFile<PostAttributes>[],
  query: string,
): ContentFile<PostAttributes>[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return posts;
  return posts.filter((p) => {
    const a = p.attributes;
    return (
      a.title.toLowerCase().includes(needle) ||
      (a.description ?? '').toLowerCase().includes(needle) ||
      (a.tags ?? []).some((t) => t.toLowerCase().includes(needle)) ||
      (typeof p.content === 'string' && p.content.toLowerCase().includes(needle))
    );
  });
}

/** Exact (case-insensitive) tag match — used by the clickable tag pills. */
export function filterPostsByTag(
  posts: ContentFile<PostAttributes>[],
  tag: string,
): ContentFile<PostAttributes>[] {
  const needle = tag.trim().toLowerCase();
  if (!needle) return posts;
  return posts.filter((p) =>
    (p.attributes.tags ?? []).some((t) => t.toLowerCase() === needle),
  );
}

/** Search box synced with the `?q=` query param of the current route. */
@Component({
  selector: 'app-post-search',
  template: `
    <form class="post-search" role="search" (submit)="$event.preventDefault()">
      <input
        type="search"
        name="q"
        placeholder="Search posts…"
        aria-label="Search posts"
        [value]="query()"
        (input)="onInput($event)"
      />
    </form>
  `,
})
export class PostSearch {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly query = computed(() => this.queryParamMap().get('q') ?? '');

  onInput(event: Event) {
    const q = (event.target as HTMLInputElement).value;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: q.trim() || null },
      replaceUrl: true,
    });
  }
}

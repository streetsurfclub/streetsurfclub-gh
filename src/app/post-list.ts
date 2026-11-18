import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContentFile } from '@analogjs/content';

import { PostAttributes } from './post.model';

/** Posts per page — keep in sync with vite.config.ts prerender routes. */
export const POSTS_PER_PAGE = 12;

@Component({
  selector: 'app-post-list',
  imports: [RouterLink, DatePipe],
  template: `
    <ul class="post-list">
      @for (post of posts(); track post.attributes.slug) {
        <li class="post-card">
          <a [routerLink]="['/blog', post.attributes.slug]">
            @if (post.attributes.coverImage) {
              <img
                [src]="post.attributes.coverImage"
                [alt]="post.attributes.title"
                loading="lazy"
                decoding="async"
              />
            }
            <div class="post-card-body">
              <h2>{{ post.attributes.title }}</h2>
              <p class="meta">
                <time [attr.datetime]="post.attributes.publishedAt">{{
                  post.attributes.publishedAt | date: 'mediumDate'
                }}</time>
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

    @if (totalPages() > 1) {
      <nav class="pagination" aria-label="Blog pagination">
        @if (page() > 1) {
          <a class="page-link" [routerLink]="page() === 2 ? '/' : '/posts/' + (page() - 1)"
            >&larr; Newer</a
          >
        }
        @for (p of pages(); track p) {
          @if (p === page()) {
            <span class="page-link current" aria-current="page">{{ p }}</span>
          } @else {
            <a class="page-link" [routerLink]="p === 1 ? '/' : '/posts/' + p">{{ p }}</a>
          }
        }
        @if (page() < totalPages()) {
          <a class="page-link" [routerLink]="'/posts/' + (page() + 1)">Older &rarr;</a>
        }
      </nav>
    }
  `,
})
export class PostList {
  readonly posts = input.required<ContentFile<PostAttributes>[]>();
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pages = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1),
  );
}

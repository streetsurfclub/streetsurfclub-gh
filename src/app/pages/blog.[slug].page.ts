import { Component } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink, ResolveFn } from '@angular/router';
import { MetaTag, RouteMeta } from '@analogjs/router';
import {
  MarkdownComponent,
  injectContent,
  injectContentFiles,
} from '@analogjs/content';

import { PostAttributes } from '../post.model';

function activePost(slug: string | null) {
  const posts = injectContentFiles<PostAttributes>((file) =>
    file.filename.includes('src/content/blog/'),
  );
  return posts.find((p) => p.attributes.slug === slug);
}

export const postTitleResolver: ResolveFn<string> = (route) =>
  activePost(route.paramMap.get('slug'))?.attributes.title ?? 'Blog';

export const postMetaResolver: ResolveFn<MetaTag[]> = (route) => {
  const post = activePost(route.paramMap.get('slug'))?.attributes;
  if (!post) return [];
  return [
    { name: 'description', content: post.description },
    { property: 'og:title', content: post.title },
    { property: 'og:description', content: post.description },
    ...(post.coverImage ? [{ property: 'og:image', content: post.coverImage }] : []),
  ];
};

export const routeMeta: RouteMeta = {
  title: postTitleResolver,
  meta: postMetaResolver,
};

@Component({
  selector: 'app-blog-post',
  imports: [AsyncPipe, DatePipe, RouterLink, MarkdownComponent],
  template: `
    @if (post$ | async; as post) {
      <article class="post">
        <a routerLink="/" class="back">&larr; All posts</a>
        <h1>{{ post.attributes.title }}</h1>
        <p class="meta">
          <time [attr.datetime]="post.attributes.publishedAt">{{ post.attributes.publishedAt | date: 'mediumDate' }}</time>
        </p>
        <ul class="tags">
          @for (tag of post.attributes.tags; track tag) {
            <li>#{{ tag }}</li>
          }
        </ul>
        @if (post.attributes.coverImage) {
          <img class="cover" [src]="post.attributes.coverImage" [alt]="post.attributes.title" />
        }
        <analog-markdown class="post-content" [content]="post.content" />
      </article>
    }
  `,
})
export default class BlogPostPage {
  readonly post$ = injectContent<PostAttributes>({ subdirectory: 'blog', param: 'slug' });
}

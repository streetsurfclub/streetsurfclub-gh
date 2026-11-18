import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { injectContentFiles } from '@analogjs/content';
import { RouteMeta } from '@analogjs/router';

import { PostAttributes } from '../post.model';
import { PostList, POSTS_PER_PAGE } from '../post-list';

export const routeMeta: RouteMeta = {
  title: (route) => `Posts — page ${route.paramMap.get('page') ?? '1'}`,
};

@Component({
  selector: 'app-posts-page',
  imports: [PostList],
  template: `
    <section class="section">
      <div class="container">
        <h1>Posts</h1>
        <app-post-list [posts]="posts" [page]="page" [totalPages]="totalPages" />
      </div>
    </section>
  `,
})
export default class PostsPage {
  private readonly route = inject(ActivatedRoute);
  readonly page = Number(this.route.snapshot.paramMap.get('page')) || 1;
  readonly allPosts = injectContentFiles<PostAttributes>((file) =>
    file.filename.includes('src/content/blog/'),
  ).sort(
    (a, b) =>
      new Date(b.attributes.publishedAt).getTime() -
      new Date(a.attributes.publishedAt).getTime(),
  );
  readonly totalPages = Math.max(1, Math.ceil(this.allPosts.length / POSTS_PER_PAGE));
  readonly posts = this.allPosts.slice(
    (this.page - 1) * POSTS_PER_PAGE,
    this.page * POSTS_PER_PAGE,
  );
}

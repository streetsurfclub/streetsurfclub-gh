import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MarkdownComponent, injectContent } from '@analogjs/content';

import { PageAttributes } from '../page.model';

@Component({
  selector: 'app-static-page',
  imports: [AsyncPipe, RouterLink, MarkdownComponent],
  template: `
    @if (page$ | async; as page) {
      <article class="post">
        <a routerLink="/" class="back">&larr; Home</a>
        <h1>{{ page.attributes.title }}</h1>
        <analog-markdown class="post-content" [content]="page.content" />
      </article>
    }
  `,
})
export default class StaticPage {
  readonly page$ = injectContent<PageAttributes>({
    subdirectory: 'pages',
    param: 'slug',
  });
}

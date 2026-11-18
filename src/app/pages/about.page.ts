import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  template: `
    <article class="post">
      <a routerLink="/" class="back">&larr; Home</a>
      <h1>About</h1>
      <div class="post-content">
        <p>StreetSurfClub — a blog built with AnalogJS and Angular, hosted on GitHub Pages.</p>
      </div>
    </article>
  `,
})
export default class AboutPage {}

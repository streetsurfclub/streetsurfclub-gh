import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  template: `
    <h1>About</h1>
    <p>StreetSurfClub — a blog built with AnalogJS, Angular and Pico.css, hosted on GitHub Pages.</p>
    <a routerLink="/">Back to posts</a>
  `,
})
export default class AboutPage {}

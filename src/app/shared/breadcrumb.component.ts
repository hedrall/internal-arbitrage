import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import 'rxjs/add/operator/filter';
import { RegistryService } from "../common/service/registry.service";

@Component({
  selector: 'app-breadcrumbs',
  template: `
  <ng-template ngFor let-breadcrumb [ngForOf]="breadcrumbs" let-last = last>
    <li class="breadcrumb-item"
        *ngIf="breadcrumb?.label?.title&&breadcrumb.url.substring(breadcrumb.url.length-1) == '/'||breadcrumb?.label?.title&&last"
        [ngClass]="{active: last}">
      <a *ngIf="!last" [routerLink]="breadcrumb.url">{{breadcrumb?.label?.title}}</a>
      <a *ngIf="last"  [routerLink]="breadcrumb.url">{{breadcrumb?.label?.title}}</a>
    </li>
  </ng-template>`
})
export class BreadcrumbsComponent implements OnInit {
  breadcrumbs: Array<Object>;
  constructor(
    private router: Router, private route: ActivatedRoute,
    private registryService: RegistryService
  ) {}
  ngOnInit(): void {
    this.router.events.filter(event => event instanceof NavigationEnd).subscribe(event => {
      this.breadcrumbs = [];
      let currentRoute = this.route.root,
      url = '';
      do {
        const childrenRoutes = currentRoute.children;
        currentRoute = null;
        childrenRoutes.forEach(route => {
          if (route.outlet === 'primary') {
            const routeSnapshot = route.snapshot;
            console.log(route.snapshot.data);
            console.log(url);
            url = url === '/' ? '' : url; // AppRouteModuleの内容は反映しない
            url += '/' + routeSnapshot.url.map(segment => segment.path).join('/');
            console.log(routeSnapshot.url.map(segment => segment.path).join('/'));
            console.log(url);
            this.breadcrumbs.push({
               label: '',//this.registryService.menu[route.snapshot.data.title],
              url: url
            });
            console.log(this.breadcrumbs);
            currentRoute = route;
          }
        });
      } while (currentRoute);
    });
  }
}

import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

// Layouts
import { FullLayoutComponent } from './layouts/full-layout.component';

export const routes: Routes = [
  {
    // テンプレートをよみこんでから、子コンポーネントを読み込む
    path: '',              // path: /
    component: FullLayoutComponent,
    data: {
      title: ''
    },
    children: [
      {
        path: 'chart', // path: /organizer
        loadChildren: './coin/chart/chart.module#ChartModule'
      },
      {
        path: '**',
        redirectTo: '/chart'
      },
    ]
  },
  {
    path: '**',
    redirectTo: '/chart',
  }
];

@NgModule({
  imports: [ RouterModule.forRoot( routes, { useHash: false } ) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}

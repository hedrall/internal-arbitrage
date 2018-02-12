import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChartComponent } from './chart.component';

const routes: Routes = [
  {
    path: '',
    component: ChartComponent,
    data: {
      title: 'Organizer'
    },
  }
];

@NgModule( {
  imports: [
    RouterModule.forChild( routes ),
  ],
  declarations: [
  ],
  exports: [RouterModule]
} )
export class ChartRoutingModule {
}

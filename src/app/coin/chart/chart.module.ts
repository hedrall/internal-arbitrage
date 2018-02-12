import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartRoutingModule } from './chart-routing.module';
import { ChartComponent } from './chart.component';
import { ChartsModule } from 'ng2-charts';
import {
  MatFormFieldModule, MatInputModule, MatOptionModule, MatSelectModule,
  MatTableModule
} from '@angular/material';
import { FormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    ChartRoutingModule,
    ChartsModule,
    FormsModule,
    MatSelectModule, MatOptionModule, MatTableModule, MatFormFieldModule, MatInputModule,
  ],
  declarations: [
    ChartComponent
  ],
  providers: [
  ]
})
export class ChartModule { }

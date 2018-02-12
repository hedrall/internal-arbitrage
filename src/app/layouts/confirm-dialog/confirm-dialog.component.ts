import { Component, EventEmitter, Inject, Input, OnInit, Output } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material";

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent {
  
  @Input( 'type' ) type: string;
  @Output( 'clearLocalStorage' ) clearLocalStorage = new EventEmitter<string>();
  
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}
  
  public clear = (): void => {
    this.clearLocalStorage.emit( this.type );
  };
  
  public close = (): void => {
    this.dialogRef.close();
  };

}

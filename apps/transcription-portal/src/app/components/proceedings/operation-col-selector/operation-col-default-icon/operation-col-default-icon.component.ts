import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { Operation } from '../../../../obj/operations/operation';
import { Task } from '../../../../obj/tasks';
import { TaskService } from '../../../../obj/tasks/task.service';

@Component({
  selector: 'tportal-operation-col-default-icon',
  templateUrl: './operation-col-default-icon.component.html',
  styleUrls: ['./operation-col-default-icon.component.scss'],
  imports: [],
})
export class OperationColDefaultIconComponent extends SubscriberComponent implements OnChanges {
  private http = inject(HttpClient);
  private taskService = inject(TaskService);
  private cd = inject(ChangeDetectorRef);

  @Input() operation?: Operation;
  @Input() task?: Task;
  @Input() mouseIn?: boolean;

  get allResultsAvailable(){
    return !this.operation?.lastRound?.results.map(a => a.available)?.includes(false);
  }

  ngOnChanges(changes: SimpleChanges) {
    const operation = changes['operation'];
    if (operation && operation.currentValue) {
      this.subscriptionManager.removeByTag('operationChange');
      /*
      this.subscribe(operation.currentValue.changes$, {
        next: () => {
          this.cd.markForCheck();
          this.cd.detectChanges();
        },
      }, "operationChange");
       */
    }

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  protected onRepeatIconClick = () => {
    if (this.task?.operations && this.task.operations[1].serviceProvider) {
      this.task.restartFailedOperation(this.http, [
        {
          name: 'GoogleASR',
          value: this.taskService.accessCode,
        },
      ]);
    }
  };
}

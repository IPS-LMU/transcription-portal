import { Component, OnInit, inject } from '@angular/core';
import { TaskService } from '../../obj/tasks/task.service';
import { ANIMATIONS } from '../../shared/Animations';

@Component({
  selector: 'tportal-protocol-footer',
  templateUrl: './protocol-footer.component.html',
  styleUrls: ['./protocol-footer.component.scss'],
  animations: [ANIMATIONS],
  standalone: true,
})
export class ProtocolFooterComponent {
  taskService = inject(TaskService);

  public test = 'inactive';

  blop() {
    this.test = 'blopped';
    setTimeout(() => {
      this.test = 'inactive';
    }, 500);
  }

  onProtoclLabelClick(tag: HTMLSpanElement) {
    if (tag.getAttribute('data-state') === 'opened') {
      tag.setAttribute('data-state', 'closed');
    } else {
      tag.setAttribute('data-state', 'opened');
    }
  }
}

import {Component, OnInit} from '@angular/core';
import {TaskService} from '../../obj/tasks/task.service';
import {ANIMATIONS} from '../../shared/Animations';

@Component({
  selector: 'app-protocol-footer',
  templateUrl: './protocol-footer.component.html',
  styleUrls: ['./protocol-footer.component.css'],
  animations: [ANIMATIONS]
})
export class ProtocolFooterComponent implements OnInit {

  public test = 'inactive';

  constructor(public taskService: TaskService) {
  }

  ngOnInit() {
  }


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

import { EntityState } from '@ngrx/entity';
import { StoreTask } from '../task';

export interface StoreTaskDirectory {
  id: number;
  type: 'folder';
  path: string;
  size?: number;
  folderName: string;
  entries: EntityState<StoreTask | StoreTaskDirectory>;
}

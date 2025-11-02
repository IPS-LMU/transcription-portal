import { EntityState } from '@ngrx/entity';
import { StoreTask } from '../task';

export interface StoreTaskDirectory {
  id: number;
  path: string;
  size?: number;
  folderName: string;
  entries: EntityState<StoreTask | StoreTaskDirectory>;
}

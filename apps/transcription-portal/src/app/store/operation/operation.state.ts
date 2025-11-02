import { EntityState } from '@ngrx/entity';
import { StoreTaskOperation } from './operation';

export interface OperationState extends EntityState<StoreTaskOperation> {}

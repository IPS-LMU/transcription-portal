import { EntityState } from '@ngrx/entity';
import { StoreItem } from './store-item';

export interface StoreItemsState extends EntityState<StoreItem> {
}

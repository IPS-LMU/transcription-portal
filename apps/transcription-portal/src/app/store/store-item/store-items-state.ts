import { EntityState } from '@ngrx/entity';
import { StoreItem } from './store-item';
import { IFile } from '@octra/annotation';

export interface OctraWindowMessageEventData {
  status?: "success" | "changed" | "error";
  data?: {
    annotation: IFile; // IFile with annotation saved as AnnotJSON.
  }
  error?: string; // only set on error
}

export interface StoreItemsState extends EntityState<StoreItem> {
}

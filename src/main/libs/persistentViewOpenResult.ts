import {
  type OpenPersistentViewResult,
  PersistentViewOpenStatus,
} from '@fudanda/electron-persistent-view';

export const isPersistentViewOpened = (
  result: OpenPersistentViewResult,
): boolean => result.status === PersistentViewOpenStatus.Opened;

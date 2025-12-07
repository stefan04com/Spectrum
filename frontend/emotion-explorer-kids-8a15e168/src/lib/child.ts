const ACTIVE_CHILD_STORAGE_KEY = 'active-child-id';

export const getStoredActiveChildId = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_CHILD_STORAGE_KEY);
};

export const setStoredActiveChildId = (childId?: string | null) => {
  if (typeof window === 'undefined') return;
  if (!childId) {
    window.localStorage.removeItem(ACTIVE_CHILD_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_CHILD_STORAGE_KEY, childId);
};

export const clearStoredActiveChildId = () => setStoredActiveChildId(null);

export { ACTIVE_CHILD_STORAGE_KEY };

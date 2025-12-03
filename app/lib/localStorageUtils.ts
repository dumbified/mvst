/**
 * Utility functions for localStorage operations
 */

const STATE_UPDATED_AT_KEY = "mvst_state_updatedAt";

/**
 * Gets the stored timestamp from localStorage
 */
export function getLocalStorageTimestamp(): string | null {
  try {
    const stateJson = localStorage.getItem(STATE_UPDATED_AT_KEY);
    if (stateJson) {
      return JSON.parse(stateJson);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Sets the timestamp in localStorage
 */
export function setLocalStorageTimestamp(timestamp: string): void {
  try {
    localStorage.setItem(STATE_UPDATED_AT_KEY, JSON.stringify(timestamp));
  } catch {
    // ignore
  }
}


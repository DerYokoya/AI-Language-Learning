/**
 * appStorage.js
 * Unified storage layer:
 *  - Logged-in users  → server-side PostgreSQL (persists across devices)
 *  - Guest users      → localStorage (persists on this browser)
 *
 * All methods are async so callers don't need to change if the backend
 * implementation changes in the future.
 */
import { storage } from "./storage.js";

export const appStorage = {
  async getItem(key) {
    if (window.currentUser) {
      try {
        const res = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
          credentials: "include",
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.value ?? null;
      } catch {
        // Fallback to localStorage on network error
        return storage.getItem(key);
      }
    }
    return storage.getItem(key);
  },

  async setItem(key, value) {
    if (window.currentUser) {
      try {
        await fetch(`/api/storage/${encodeURIComponent(key)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ value: String(value) }),
        });
        return;
      } catch {
        // Fallback
      }
    }
    storage.setItem(key, value);
  },

  async removeItem(key) {
    if (window.currentUser) {
      try {
        await fetch(`/api/storage/${encodeURIComponent(key)}`, {
          method: "DELETE",
          credentials: "include",
        });
        return;
      } catch {
        // Fallback
      }
    }
    storage.removeItem(key);
  },

  /**
   * Migrate all current localStorage keys to the server
   * (called once after a guest logs in or signs up).
   */
  async migrateGuestDataToServer() {
    if (!window.currentUser) return;
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        await this.setItem(key, value);
      }
    }
  },
};
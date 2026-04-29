import { storage } from "./storage.js";

export const appStorage = {
  async getItem(key) {
    if (window.currentUser) {
      const res = await fetch(`/api/storage/${key}`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.value;
    }
    return storage.getItem(key);
  },

  async setItem(key, value) {
    if (window.currentUser) {
      await fetch(`/api/storage/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value }),
      });
      return;
    }
    storage.setItem(key, value);
  },

  async removeItem(key) {
    if (window.currentUser) {
      await fetch(`/api/storage/${key}`, {
        method: "DELETE",
        credentials: "include",
      });
      return;
    }
    storage.removeItem(key);
  }
};

// storage.js — safe localStorage wrapper
// Falls back to in-memory storage when localStorage is unavailable
// (e.g. sandboxed iframes, Claude artifacts, private browsing with strict settings)

const _memStore = {};

function _isLocalStorageAvailable() {
  try {
    const key = '__storage_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

const _useReal = _isLocalStorageAvailable();

export const storage = {
  getItem(key) {
    if (_useReal) return localStorage.getItem(key);
    return Object.prototype.hasOwnProperty.call(_memStore, key) ? _memStore[key] : null;
  },
  setItem(key, value) {
    if (_useReal) { localStorage.setItem(key, value); return; }
    _memStore[key] = String(value);
  },
  removeItem(key) {
    if (_useReal) { localStorage.removeItem(key); return; }
    delete _memStore[key];
  }
};

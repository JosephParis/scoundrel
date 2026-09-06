/**
 * A localStorage stand-in for vitest's `node` environment.
 *
 * The sync layer is defined by what it reads back out of storage, so a test
 * that stubs the module's reads instead of storage itself would assert the
 * mock rather than the round trip. This is the real Storage contract -- string
 * keys, string values, `null` for a miss -- so `snapshotLocalState` and
 * `applyCloudState` run unmodified against it.
 */

export function installLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial))
  const stub = {
    getItem: key => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => { store.set(String(key), String(value)) },
    removeItem: key => { store.delete(String(key)) },
    clear: () => { store.clear() },
    key: i => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
    /** Test-only: the raw map, for asserting on what was written. */
    _dump: () => Object.fromEntries(store),
  }
  globalThis.localStorage = stub
  return stub
}

export function uninstallLocalStorage() {
  delete globalThis.localStorage
}

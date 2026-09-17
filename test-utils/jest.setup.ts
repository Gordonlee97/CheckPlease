// jsdom doesn't provide structuredClone, which fake-indexeddb uses to store
// records. The sessions we persist are plain JSON, so this stand-in is enough.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
}

export {}

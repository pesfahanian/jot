// A small most-recently-used cache: reading or writing an entry makes it
// the newest, and the oldest go once there are more than `keep`.
export class Lru<V> {
  private map = new Map<string, V>()
  private keep: number
  constructor(keep: number) {
    this.keep = keep
  }
  get size() {
    return this.map.size
  }
  has(k: string) {
    return this.map.has(k)
  }
  get(k: string): V | undefined {
    const v = this.map.get(k)
    if (v !== undefined) this.set(k, v)
    return v
  }
  set(k: string, v: V) {
    this.map.delete(k)
    this.map.set(k, v)
    while (this.map.size > this.keep) this.map.delete(this.map.keys().next().value!)
  }
}

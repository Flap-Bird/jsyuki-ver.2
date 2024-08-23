class Cache {
constructor(ttlSeconds, maxSize = 128) {
this.ttl = ttlSeconds * 1000;
this.maxSize = maxSize;
this.cache = new Map();
this.order = new Map();
this.size = 0;
this.lock = false;
}

_clearExpired() {
const now = Date.now();
for (const [key, { expire }] of this.cache.entries()) {
if (expire <= now) {
this.cache.delete(key);
this.order.delete(key);
this.size--;
}
}
}

_evictIfNecessary() {
if (this.size >= this.maxSize) {
const oldestKey = this.order.keys().next().value;
this.cache.delete(oldestKey);
this.order.delete(oldestKey);
this.size--;
}
}

wrap(func) {
const cache = this;

return function(...args) {
const key = JSON.stringify(args);

if (cache.lock) {
throw new Error("Cache is locked");
}
cache.lock = true;

cache._clearExpired();

if (cache.cache.has(key)) {
const { value } = cache.cache.get(key);
cache.lock = false;
return value;
}

const result = func(...args);

cache._evictIfNecessary();

cache.cache.set(key, {
value: result,
expire: Date.now() + cache.ttl
});
cache.order.set(key, true);
cache.size++;

cache.lock = false;
return result;
};
}

clear() {
this.cache.clear();
this.order.clear();
this.size = 0;
}

getCacheInfo() {
return {
size: this.size,
maxSize: this.maxSize,
};
}
}

export default Cache;
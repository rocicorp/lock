# Lock

Provides `Lock` and `RWLock` (read write lock) synchronization primitives for
protecting in-memory state across multiple tasks and/or microtasks.

This is a wholesale fork of [`@rocicorp/lock`](https://github.com/rocicorp/lock) but adds `RWLockMap` functionality.

# Installation

```
npm install @ccorcos/lock
```

# Usage

`Lock` is a mutex that can be used to synchronize access to a shared resource.

```ts
import {Lock} from '@ccorcos/lock';

const lock = new Lock();

async function f(n) {
  const v = await lock.withLock(async () => {
    await sleep(1000);
    return n;
  });
  console.log(n);
}

void f(1);
void f(2);
// prints 1 at t=1000
// prints 2 at t=2000
```

`RWLock` is a read write lock. There can be mutlipe readers at the same time but only one writer at the same time.

```js
import {RWLock} from '@ccorcos/lock';

const rwLock = new RWLock();

async function read(n) {
  const v = await lock.withRead(async () => {
    await sleep(1000);
    return n;
  });
  console.log('read', n);
}

async function write(n) {
  const v = await lock.withWrite(async () => {
    await sleep(1000);
    return n;
  });
  console.log('write', n);
}

void read(1);
void write(2);
void read(3);
// prints read 1 at t=1000
// prints read 3 at t=1000
// prints write 2 at t=2000
```

Both `Lock` and `RWLock` expose non "with" methods (`lock`, `read` and `write`). These returns a promise to a release function that resolves when the lock is acquired. This is useful when you cannot wrap your code in a function like the examples above. When using these For example:

```js
const lock = new Lock();

const release = await lock.lock();
// here we got the lock
// do something
release();
```

`RWLockMap` will dynamically create and clean up locks keyed by a string.

```js
import {RWLockMap} from '@ccorcos/lock';

const lockMap = new RWLockMap();
const release1 = await lockMap.read("node1");
const release2 = await lockMap.write("node2");
const v3 = await lockMap.withRead("node3", async () => {
  return 3;
});
const v4 = await lockMap.withWrite("node4", async () => {
  return 4;
});
```
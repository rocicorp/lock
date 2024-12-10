import {resolver} from '@rocicorp/resolver';

export class Lock {
  private _lockP: Promise<void> | null = null;

  async lock(): Promise<() => void> {
    const previous = this._lockP;
    const {promise, resolve} = resolver();
    this._lockP = promise;
    await previous;
    return () => {
      if (this._lockP === promise) this._lockP = null;
      resolve();
    };
  }

  withLock<R>(f: () => R | Promise<R>): Promise<R> {
    return run(this.lock(), f);
  }

  get locked() {
    return this._lockP !== null;
  }
}

export class RWLock {
  private _lock = new Lock();
  private _writeP: Promise<void> | null = null;
  private _readP: Set<Promise<void>> = new Set();

  read(): Promise<() => void> {
    return this._lock.withLock(async () => {
      await this._writeP;
      const {promise, resolve} = resolver();
      this._readP.add(promise);
      return () => {
        this._readP.delete(promise);
        resolve();
      };
    });
  }

  withRead<R>(f: () => R | Promise<R>): Promise<R> {
    return run(this.read(), f);
  }

  async write(): Promise<() => void> {
    return await this._lock.withLock(async () => {
      await this._writeP;
      await Promise.all(this._readP);
      const {promise, resolve} = resolver();
      this._writeP = promise;
      this._readP.clear();
      return () => {
        if (this._writeP === promise) this._writeP = null;
        resolve();
      };
    });
  }

  withWrite<R>(f: () => R | Promise<R>): Promise<R> {
    return run(this.write(), f);
  }

  get locked() {
    return this._lock.locked || this._writeP !== null || this._readP.size > 0;
  }
}

async function run<R>(
  p: Promise<() => void>,
  f: () => R | Promise<R>,
): Promise<R> {
  const release = await p;
  try {
    return await f();
  } finally {
    release();
  }
}

export class RWLockMap {
  private _locks = new Map<string, RWLock>();

  private getLock(key: string) {
    const lock = this._locks.get(key);
    if (lock) return lock;
    const newLock = new RWLock();
    this._locks.set(key, newLock);
    return newLock;
  }

  private deleteLock(key: string) {
    this._locks.delete(key);
  }

  async read(key: string): Promise<() => void> {
    const lock = this.getLock(key);
    const release = await lock.read();
    return () => {
      release();
      if (!lock.locked) this.deleteLock(key);
    };
  }

  async withRead<R>(key: string, f: () => R | Promise<R>): Promise<R> {
    const lock = this.getLock(key);
    const result = await lock.withRead(f);
    if (!lock.locked) this.deleteLock(key);
    return result;
  }

  async write(key: string): Promise<() => void> {
    const lock = this.getLock(key);
    const release = await lock.write();
    return () => {
      release();
      if (!lock.locked) this.deleteLock(key);
    };
  }

  async withWrite<R>(key: string, f: () => R | Promise<R>): Promise<R> {
    const lock = this.getLock(key);
    const result = await lock.withWrite(f);
    if (!lock.locked) this.deleteLock(key);
    return result;
  }
}

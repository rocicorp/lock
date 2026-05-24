export class Lock {
  #lockP: Promise<void> | null = null;

  async lock(): Promise<() => void> {
    const previous = this.#lockP;
    const {promise, resolve} = Promise.withResolvers<void>();
    this.#lockP = promise;
    await previous;
    return resolve;
  }

  withLock<R>(f: () => R | Promise<R>): Promise<R> {
    return run(this.lock(), f);
  }
}

export class RWLock {
  #lock = new Lock();
  #writeP: Promise<void> | null = null;
  #readP: Promise<void>[] = [];

  read(): Promise<() => void> {
    return this.#lock.withLock(async () => {
      await this.#writeP;
      const {promise, resolve} = Promise.withResolvers<void>();
      this.#readP.push(promise);
      return resolve;
    });
  }

  withRead<R>(f: () => R | Promise<R>): Promise<R> {
    return run(this.read(), f);
  }

  async write(): Promise<() => void> {
    return await this.#lock.withLock(async () => {
      await this.#writeP;
      await Promise.all(this.#readP);
      const {promise, resolve} = Promise.withResolvers<void>();
      this.#writeP = promise;
      this.#readP = [];
      return resolve;
    });
  }

  withWrite<R>(f: () => R | Promise<R>): Promise<R> {
    return run(this.write(), f);
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

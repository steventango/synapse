export default class Pool<T> {
  concurrency: number;
  max_concurrency: number;
  queue: (() => Promise<void>)[];

  constructor(max_concurrency: number) {
    this.concurrency = 0;
    this.max_concurrency = max_concurrency;
    this.queue = [];
  }

  /**
   * Processes queue of promises with a max concurrency.
   */
  async _next() {
    if (this.queue.length && this.concurrency < this.max_concurrency) {
      ++this.concurrency;
      const promise = this.queue.pop();
      try {
        await promise();
      } catch (error) {
        console.error(error);
      }
      --this.concurrency;
      this._next();
    }
  }

  /**
   * Adds a promise to the queue
   * @param promise promise to enqueue
   * @return promise result
   */
  async add(promise: () => Promise<T>) {
    this._next();
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => promise().then(resolve).catch(reject));
    });
  }
}

export class Worker {
  constructor({ publisher, intervalMs = 1000, logger = console }) {
    this.publisher = publisher;
    this.intervalMs = intervalMs;
    this.logger = logger;
    this.timer = null;
    this.running = false;
    this.lastResult = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((error) => this.logger.error(`[worker] tick failed: ${error.message}`));
    }, this.intervalMs);
    this.logger.log(`[worker] started interval=${this.intervalMs}ms`);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.logger.log('[worker] stopped');
  }

  async tick() {
    if (this.running) return this.lastResult;
    this.running = true;

    try {
      const result = await this.publisher.runDue();
      this.lastResult = result;
      if (result.claimed > 0) {
        this.logger.log(
          `[worker] claimed=${result.claimed} published=${result.published} retrying=${result.retrying} failed=${result.failed} rate_limited=${result.rate_limited}`,
        );
      }
      return result;
    } finally {
      this.running = false;
    }
  }
}

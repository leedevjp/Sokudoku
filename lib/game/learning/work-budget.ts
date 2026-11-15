/** Yield only after useful work has consumed a slice; never select ahead. */
export class WorkBudget {
  private started = performance.now();
  exhausted() { return performance.now() - this.started >= 6; }
  async yield() {
    const scheduler = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } }).scheduler;
    if (scheduler?.yield) await scheduler.yield();
    else await new Promise<void>(resolve => setTimeout(resolve, 0));
    this.started = performance.now();
  }
}

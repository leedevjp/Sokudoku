/** Async result persistence/retry state; rendering and game rules stay with the scene. */
export class RunPersistence {
  saving = false;
  retrying = false;
  saved: boolean | null = null;
  reset() {
    this.saved = null;
  }
  save(
    operation: () => Promise<boolean>,
    active: () => boolean,
    redraw: () => void,
  ) {
    this.saving = true;
    redraw();
    void operation()
      .then((saved) => {
        if (!active()) return;
        this.saved = saved;
        this.saving = false;
        redraw();
      })
      .catch(() => {
        this.saved = false;
        this.saving = false;
        redraw();
      });
  }
  retry<T>(
    operation: () => Promise<T>,
    success: (value: T) => void,
    failure: () => void,
  ) {
    if (this.saving || this.retrying) return;
    this.retrying = true;
    void operation()
      .then((value) => {
        this.retrying = false;
        success(value);
      })
      .catch(() => {
        this.retrying = false;
        failure();
      });
  }
}

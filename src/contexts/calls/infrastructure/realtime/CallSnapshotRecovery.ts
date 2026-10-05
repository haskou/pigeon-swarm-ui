export class CallSnapshotRecovery {
  private generation = 0;
  private readonly pending = new Map<string, Promise<void>>();
  private readonly delays = new Set<() => void>();

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      const timer: { id?: ReturnType<typeof setTimeout> } = {};
      const complete = (): void => {
        clearTimeout(timer.id);
        this.delays.delete(complete);
        resolve();
      };
      timer.id = setTimeout(complete, milliseconds);
      this.delays.add(complete);
    });
  }

  private async run<T>(
    generation: number,
    load: () => Promise<T>,
    apply: (value: T) => void,
    failed: (error: unknown) => void,
    attempt = 0,
  ): Promise<void> {
    if (generation !== this.generation) return;
    try {
      const value = await load();

      if (generation === this.generation) apply(value);
    } catch (error) {
      if (generation !== this.generation) return;

      if (attempt === 2) {
        failed(error);

        return;
      }
      await this.delay((attempt + 1) * 1000);
      await this.run(generation, load, apply, failed, attempt + 1);
    }
  }

  public reset(): void {
    this.generation += 1;
    for (const cancel of this.delays) cancel();
    this.delays.clear();
    this.pending.clear();
  }

  public request<T>(
    key: string,
    load: () => Promise<T>,
    apply: (value: T) => void,
    failed: (error: unknown) => void,
  ): Promise<void> {
    const current = this.pending.get(key);

    if (current) return current;
    const generation = this.generation;
    const pending = this.run(generation, load, apply, failed).finally(() => {
      if (this.pending.get(key) === pending) this.pending.delete(key);
    });
    this.pending.set(key, pending);

    return pending;
  }
}

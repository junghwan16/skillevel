/**
 * A fixed-size worker pool for async jobs, shared by the eval runner and the
 * bench runner.
 */

export type Job = () => Promise<void>;

export type ProgressFn = (done: number, total: number) => void;

/** Run jobs with a fixed worker pool. */
export async function runPool(
  jobs: Job[],
  size: number,
  onProgress?: ProgressFn,
): Promise<void> {
  let nextIndex = 0;
  let done = 0;
  const worker = async () => {
    while (nextIndex < jobs.length) {
      const job = jobs[nextIndex++]!;
      await job();
      onProgress?.(++done, jobs.length);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(size, jobs.length) }, worker),
  );
}

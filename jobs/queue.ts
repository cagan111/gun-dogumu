/** İş kuyruğu adaptörü. Üretimde pg-boss; testlerde MemoryQueue; JOBS_QUEUE=none ile hiçbir şey yapmaz. */
export const JOB = {
  otpRequest: "request-otp",
  campaign: "campaign-recovery",
  reviewRecovery: "review-recovery",
  confirmation: "send-confirmation",
  reminder: "send-reminder",
  notice: "send-notice",
  subscriptionTick: "subscription-tick",
  monthlyCredits: "monthly-credits",
  messageRecovery: "message-recovery",
} as const;
export type JobName = (typeof JOB)[keyof typeof JOB];

export interface EnqueueOpts { startAfter?: Date; singletonKey?: string }
export interface JobQueue {
  enqueue(name: JobName, data: Record<string, unknown>, opts?: EnqueueOpts): Promise<string | null>;
}

export class NoopQueue implements JobQueue {
  async enqueue(): Promise<string | null> { return null; }
}

/** Bellek içi sahte kuyruk (test): aynı singletonKey ikinci kez eklenmez. */
export class MemoryQueue implements JobQueue {
  jobs: { id: string; name: JobName; data: Record<string, unknown>; startAfter: Date | null; singletonKey: string | null }[] = [];
  async enqueue(name: JobName, data: Record<string, unknown>, opts: EnqueueOpts = {}): Promise<string | null> {
    const key = opts.singletonKey ?? null;
    if (key && this.jobs.some((j) => j.name === name && j.singletonKey === key)) return null;
    const id = `mem-${this.jobs.length + 1}`;
    this.jobs.push({ id, name, data, startAfter: opts.startAfter ?? null, singletonKey: key });
    return id;
  }
}

let current: JobQueue | null = null;
export function setQueue(q: JobQueue | null): void { current = q; }

export async function getQueue(): Promise<JobQueue> {
  if (current) return current;
  if (process.env.JOBS_QUEUE === "none") return (current = new NoopQueue());
  const { PgBossQueue } = await import("./boss");
  return (current = new PgBossQueue());
}

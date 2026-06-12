import { AsyncLocalStorage } from "async_hooks";

interface CfContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

const storage = new AsyncLocalStorage<CfContext>();

export function runWithCfContext<T>(ctx: CfContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function cfWaitUntil(promise: Promise<unknown>): void {
  const ctx = storage.getStore();
  if (ctx) {
    ctx.waitUntil(promise);
  }
  // In environments without a context (e.g. tests), the promise runs unguarded
}

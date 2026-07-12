export async function yieldAfterMessageDecryptBatch(): Promise<void> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
}

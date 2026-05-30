export async function loadApplicationContainer(): Promise<
  typeof import('./applicationContainer').applicationContainer
> {
  const module = await import('./applicationContainer');

  return module.applicationContainer;
}

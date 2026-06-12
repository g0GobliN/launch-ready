/** README setup is bundled into .env.example when both issues are present. */
export function isReadmeBundledWithEnvExample(scanFixIds: Iterable<string>): boolean {
  const ids = new Set(scanFixIds);
  return ids.has("env-example") && ids.has("readme");
}

/** Auto-include readme when env-example is selected and readme is also missing. */
export function expandBundledFixIds(fixIds: string[], scanFixIds: Iterable<string>): string[] {
  const expanded = new Set(fixIds);
  if (expanded.has("env-example") && isReadmeBundledWithEnvExample(scanFixIds)) {
    expanded.add("readme");
  }
  return [...expanded];
}

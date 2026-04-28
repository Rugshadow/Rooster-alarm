type StopFn = () => void;
const registry = new Set<StopFn>();

export function registerAudioStop(fn: StopFn): () => void {
  registry.add(fn);
  return () => registry.delete(fn);
}

export function stopAllAudio() {
  registry.forEach((fn) => fn());
}

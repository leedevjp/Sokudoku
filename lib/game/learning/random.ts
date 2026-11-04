/** Fresh OS-backed randomness on every draw; no application-managed seed. */
export function cryptoRandom(): number {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return value / 0x1_0000_0000;
}

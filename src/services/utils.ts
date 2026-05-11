export async function simulateAsync<T>(payload: T, delay = 120): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, delay))
  return structuredClone(payload)
}

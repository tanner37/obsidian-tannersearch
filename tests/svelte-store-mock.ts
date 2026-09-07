export const writable = <T>(value: T) => ({
  subscribe(run: (value: T) => void) {
    run(value)
    return () => undefined
  },
  set(next: T) {
    value = next
  },
  update(updateValue: (value: T) => T) {
    value = updateValue(value)
  },
})

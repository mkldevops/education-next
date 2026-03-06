export function checkCapacity(capacity: number, currentEnrolled: number): 'OK' | 'classFull' {
  return currentEnrolled < capacity ? 'OK' : 'classFull'
}

export function validateCapacityUpdate(
  newCapacity: number,
  currentEnrolled: number
): 'OK' | 'capacityBelowEnrolled' {
  return newCapacity >= currentEnrolled ? 'OK' : 'capacityBelowEnrolled'
}

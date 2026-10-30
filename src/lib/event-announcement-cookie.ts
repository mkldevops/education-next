/** Versioned by the event edit time, just like the previous localStorage preference. */
export function eventAnnouncementCookieName(id: string, updatedAt: string) {
  return `event-dismissed-${encodeURIComponent(id)}-${new Date(updatedAt).getTime()}`
}

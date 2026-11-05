export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const INSTALL_PROMPT_READY = 'installpromptready'

type InstallPromptWindow = Window & { __installPrompt?: InstallPromptEvent | null }

// Chrome fires beforeinstallprompt once per document, often before hydration and possibly while
// the login page is shown: capture it in the head and keep it on window for every later mount.
export const captureInstallPromptScript = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installPrompt=e;window.dispatchEvent(new Event('${INSTALL_PROMPT_READY}'))});window.addEventListener('appinstalled',function(){window.__installPrompt=null})`

export function getInstallPrompt() {
  return (window as InstallPromptWindow).__installPrompt ?? null
}

export function setInstallPrompt(event: InstallPromptEvent | null) {
  ;(window as InstallPromptWindow).__installPrompt = event
}

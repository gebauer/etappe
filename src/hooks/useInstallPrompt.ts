import { useEffect, useState } from 'react';

/**
 * Chrome's `beforeinstallprompt`. Not in `lib.dom` because it is not a
 * standard — Safari and Firefox never fire it, so the button this drives
 * simply never appears there (iOS installs through Share → Add to Home
 * Screen, which a page cannot trigger).
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * An install affordance of our own (author, 2026-09-10: "neither Vivaldi
 * nor Chrome asks for install").
 *
 * They do not ask any more. Chrome dropped the automatic install banner
 * years ago — installing is a ⋮ menu item most people never look for — and
 * a site that wants to be installed is expected to say so itself. The
 * browser hands over the prompt through this event exactly once; we keep it
 * and fire it when the user asks.
 *
 * Worth the button here because standalone is not cosmetic on a phone: it
 * returns the ~180px of URL bar and tab strip that the itinerary drawer is
 * competing for.
 */
export function useInstallPrompt(): {
  canInstall: boolean;
  install: () => Promise<void>;
} {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      // Suppress Chrome's own mini-infobar; we render the invitation.
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    }
    function onInstalled() {
      setPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return {
    canInstall: prompt !== null,
    async install() {
      if (!prompt) return;
      await prompt.prompt();
      await prompt.userChoice;
      // Single-use: the browser will hand over a fresh event if the user
      // declined and later becomes eligible again.
      setPrompt(null);
    },
  };
}

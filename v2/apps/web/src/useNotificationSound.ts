import { useMemo, useSyncExternalStore } from "react";
import { notificationSoundFor } from "./notificationSound";

export function useNotificationSound(userId: string) {
  const sound = useMemo(() => notificationSoundFor(userId), [userId]);
  const muted = useSyncExternalStore(sound.subscribe, sound.isMuted, () => false);
  // The store subscription owns browser listeners and the shared AudioContext.
  return { sound, muted, setMuted: sound.setMuted };
}

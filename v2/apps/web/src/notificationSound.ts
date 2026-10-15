export type SoundEvent = { id: string; createdAt: string };
type SoundHistory = { latestAt: number; ids: string[] };
const HISTORY_LIMIT = 2000;
const MUTED_KEY = "designhub-v2-notification-sound-muted:";
const HISTORY_KEY = "designhub-v2-notification-sound-seen:";

/** One attack, one sine, no overlapping notes. Peak stays well below full scale. */
export function scheduleNotificationDing(context: AudioContext | OfflineAudioContext) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.36, now + 0.008);
  gain.gain.setValueAtTime(0.36, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.42);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  return () => {
    // A short fade avoids clicks if the user mutes while the ding is playing.
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setTargetAtTime(0.0001, context.currentTime, 0.004);
  };
}

/** A successful first snapshot is a silent baseline, including after a reload. */
export class NotificationSoundTracker {
  private initialized = false;
  private history: SoundHistory = { latestAt: 0, ids: [] };
  constructor(private storage: Pick<Storage, "getItem" | "setItem"> | null, private key: string) {}

  consume(events: SoundEvent[]): boolean {
    try {
      const saved = JSON.parse(this.storage?.getItem(this.key) ?? "null");
      if (saved && Number.isFinite(saved.latestAt) && Array.isArray(saved.ids)) {
        this.history.latestAt = Math.max(this.history.latestAt, saved.latestAt);
        this.history.ids = [...new Set([...saved.ids.filter((id: unknown) => typeof id === "string"), ...this.history.ids])];
      }
    } catch { /* Memory tracking still works when local storage is unavailable. */ }
    // An empty initial inbox must not make historical backfills sound new.
    if (!this.initialized && !events.length && !this.history.latestAt) this.history.latestAt = Math.floor(Date.now() / 1000) * 1000;
    const previousAt = this.history.latestAt;
    const seen = new Set(this.history.ids);
    const fresh = events.some(event => !seen.has(event.id) && Number.isFinite(Date.parse(event.createdAt)) && Date.parse(event.createdAt) >= previousAt);
    for (const event of events) {
      // Reinserting keeps the newest snapshot's IDs when trimming history.
      seen.delete(event.id);
      seen.add(event.id);
      const timestamp = Date.parse(event.createdAt);
      if (Number.isFinite(timestamp)) this.history.latestAt = Math.max(this.history.latestAt, timestamp);
    }
    this.history.ids = [...seen].slice(-HISTORY_LIMIT);
    try {
      const serialized = JSON.stringify(this.history);
      if (this.storage?.getItem(this.key) !== serialized) this.storage?.setItem(this.key, serialized);
    } catch { /* No effect on visual notifications. */ }
    const shouldNotify = this.initialized && fresh;
    this.initialized = true;
    return shouldNotify;
  }
}

function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

class NotificationSound {
  private context: AudioContext | null = null;
  private listeners = new Set<() => void>();
  private muted = false;
  private lastPlayedAt = -Infinity;
  private stopTone: (() => void) | null = null;
  private pendingUnlock: Promise<void> | null = null;
  constructor(private userId: string) { this.readMuted(); }
  private readMuted() {
    try { const storage = browserStorage(); if (storage) this.muted = storage.getItem(MUTED_KEY + this.userId) === "1"; } catch { /* Keep the in-memory preference. */ }
  }
  isMuted = () => this.muted;
  private onStorage = (event: StorageEvent) => {
    if (event.key !== MUTED_KEY + this.userId && event.key !== null) return;
    this.readMuted();
    if (this.muted) this.stopTone?.();
    this.listeners.forEach(listener => listener());
  };
  // Called only from a real user gesture, never from polling or a queued event.
  unlock = () => {
    if (this.muted || this.pendingUnlock) return;
    try {
      const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!this.context || this.context.state === "closed") this.context = new AudioContextCtor();
      if (this.context.state !== "running") {
        this.pendingUnlock = this.context.resume().catch(() => undefined).finally(() => { this.pendingUnlock = null; });
      }
    } catch { /* Browsers may deny audio; visual notifications continue. */ }
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.readMuted();
      window.addEventListener("pointerdown", this.unlock);
      window.addEventListener("keydown", this.unlock);
      window.addEventListener("storage", this.onStorage);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size) return;
      window.removeEventListener("pointerdown", this.unlock);
      window.removeEventListener("keydown", this.unlock);
      window.removeEventListener("storage", this.onStorage);
      this.stopTone?.();
      this.stopTone = null;
      void this.context?.close().catch(() => undefined);
      this.context = null;
    };
  };
  setMuted = (muted: boolean) => {
    this.muted = muted;
    try { browserStorage()?.setItem(MUTED_KEY + this.userId, muted ? "1" : "0"); } catch { /* Session preference still applies. */ }
    if (muted) this.stopTone?.();
    else this.unlock();
    this.listeners.forEach(listener => listener());
  };
  observer(source: "internal-approval" | "dashboard") {
    const tracker = new NotificationSoundTracker(browserStorage(), `${HISTORY_KEY}${this.userId}:${source}`);
    return (events: SoundEvent[]) => {
      // Consume even while muted/blocked: never replay old events after unmuting.
      if (!tracker.consume(events)) return;
      if (this.muted || this.context?.state !== "running") return;
      const now = Date.now();
      // Coalesce bursts and simultaneous feeds into one ding without stacking gain.
      if (now - this.lastPlayedAt < 1000) return;
      try {
        this.stopTone = scheduleNotificationDing(this.context);
        this.lastPlayedAt = now;
      } catch { /* Audio is complementary to the existing visual feed. */ }
    };
  }
}

const users = new Map<string, NotificationSound>();
export function notificationSoundFor(userId: string) {
  let sound = users.get(userId);
  if (!sound) { sound = new NotificationSound(userId); users.set(userId, sound); }
  return sound;
}

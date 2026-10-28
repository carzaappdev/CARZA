/** Reels load on black, like the player, instead of flashing a light skeleton. */
export default function Loading() {
  return (
    <div
      className="relative mx-auto grid h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] w-full place-items-center bg-black md:h-[calc(100dvh-4rem)] md:max-w-[480px]"
      aria-busy="true"
    >
      <span className="sr-only">Loading…</span>
      <span className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  );
}

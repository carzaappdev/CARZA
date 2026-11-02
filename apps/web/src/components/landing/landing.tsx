import type { Route } from 'next';
import Link from 'next/link';
import {
  BellRingIcon,
  CalendarDaysIcon,
  CarFrontIcon,
  ClapperboardIcon,
  MapPinIcon,
  MessagesSquareIcon,
  SparklesIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import { getFoundingSpotsLeft } from '@carza/db';
import { CarzaLogo, CarzaMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

/** Logged-out visitors land here; "Look around" opens the feed itself. */
export const LOOK_AROUND_HREF = '/?feed=for-you' as Route;

const TABS: { Icon: LucideIcon; name: string; line: string; points: string[] }[] = [
  {
    Icon: MessagesSquareIcon,
    name: 'Feed',
    line: 'Post your build, your drive, your Saturday.',
    points: [
      'Photo posts, replies and likes',
      'Follow the people who make your scene',
      '#tags and @mentions to find your crowd',
    ],
  },
  {
    Icon: ClapperboardIcon,
    name: 'Reels',
    line: 'Short vertical car videos. Swipe for the next one.',
    points: [
      'Cold starts, launches, walkarounds',
      'The next reel is loaded before you swipe',
      'Comments right on the video',
    ],
  },
  {
    Icon: CalendarDaysIcon,
    name: 'Events',
    line: 'Host a meet, cruise or show in a minute.',
    points: [
      'Meets near you, sorted by distance',
      'RSVP and add it to your calendar',
      'See which friends are going',
    ],
  },
];

const MORE: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: CarFrontIcon,
    title: 'Your garage is your profile',
    body: 'Add the cars you drive and the ones you’re building. People follow you for the car, then stay for you.',
  },
  {
    Icon: MapPinIcon,
    title: 'Built around where you are',
    body: 'Set your home ZIP once. Carza shows the meets, cruises and people near you first.',
  },
  {
    Icon: BellRingIcon,
    title: 'Never miss the meet',
    body: 'Get a heads-up when someone follows you, replies, or an event you’re going to is about to start.',
  },
];

/** Spotlight + floor glow, shared with the sign-in panel. */
const SPOTLIGHT =
  'radial-gradient(60% 45% at 50% 30%, rgba(255,255,255,0.14), transparent 70%), radial-gradient(45% 12% at 50% 72%, rgba(255,255,255,0.10), transparent 75%)';

export async function Landing() {
  const spotsLeft = await getFoundingSpotsLeft(await createClient()).catch(() => null);
  const spotsLine =
    spotsLeft === null
      ? 'Join the founding 1,000'
      : spotsLeft > 0
        ? `${spotsLeft.toLocaleString('en-US')} of 1,000 founding spots left`
        : null;

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">Carza: your local car scene</h1>

      {/* Hero: always dark, like a showroom. */}
      <section className="bg-brand-ink relative isolate overflow-hidden text-white">
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: SPOTLIGHT }} />
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 pt-14 pb-16 text-center sm:px-6 sm:pt-20 sm:pb-24">
          {spotsLine ? (
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white/90 ring-1 ring-white/15 transition-colors hover:bg-white/15"
            >
              <SparklesIcon className="size-3.5 text-amber-300" aria-hidden />
              {spotsLine}
            </Link>
          ) : null}

          <p className="font-display mt-7 text-[2.5rem] leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Your local car scene,
            <br />
            <span className="bg-gradient-to-r from-white to-white/55 bg-clip-text text-transparent">
              all in one place.
            </span>
          </p>
          <p className="mt-5 max-w-xl text-base text-white/75 sm:text-lg">
            Share your ride, swipe through car reels and find the meets, cruises and shows happening
            near you.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-white px-8 text-base font-semibold text-black hover:bg-white/90"
            >
              <Link href="/sign-up">Join Carza</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 rounded-full px-8 text-base font-semibold text-white ring-1 ring-white/25 hover:bg-white/10 hover:text-white"
            >
              <Link href={LOOK_AROUND_HREF}>Look around first</Link>
            </Button>
          </div>

          <div className="relative mt-14 w-full max-w-[620px]">
            <CarzaMark
              tone="dark"
              className="h-auto w-full drop-shadow-[0_0_40px_rgba(255,255,255,0.18)]"
            />
            <div aria-hidden className="absolute top-full left-0 h-14 w-full overflow-hidden">
              <CarzaMark
                tone="dark"
                className="pointer-events-none h-auto w-full -scale-y-100 opacity-[0.07] [mask-image:linear-gradient(to_bottom,black,transparent_60%)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* The three tabs */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Three tabs. Everything car.
          </h2>
          <p className="text-muted-foreground mt-3 text-base sm:text-lg">
            No clutter. Just your people, their cars and where they’ll be this weekend.
          </p>
        </div>
        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {TABS.map(({ Icon, name, line, points }) => (
            <li
              key={name}
              className="bg-card ring-border flex flex-col gap-4 rounded-2xl p-6 ring-1"
            >
              <span className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-xl">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold">{name}</h3>
                <p className="mt-1 text-[15px] font-medium">{line}</p>
              </div>
              <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
                {points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span
                      aria-hidden
                      className="bg-foreground/40 mt-2 size-1 shrink-0 rounded-full"
                    />
                    {p}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {/* Garage, local, notifications */}
      <section className="bg-muted/50 border-y">
        <ul className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3 md:py-20">
          {MORE.map(({ Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-3">
              <Icon className="size-6" aria-hidden />
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="text-muted-foreground text-[15px] leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Founding 1,000 */}
      <section className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-3 py-1.5 text-sm font-semibold text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-300">
          <SparklesIcon className="size-4" aria-hidden />
          Founding member #1–1,000
        </span>
        <h2 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
          Be one of the first 1,000.
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base sm:text-lg">
          The first 1,000 people to join get a numbered founding badge on their profile, for good.
          Share your invite link and everyone who joins through it follows you from day one.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 rounded-full px-8 text-base font-semibold">
            <Link href="/sign-up">
              <UserPlusIcon aria-hidden />
              Claim your number
            </Link>
          </Button>
          {spotsLeft ? (
            <p className="text-muted-foreground text-sm">
              {spotsLeft.toLocaleString('en-US')} spots left
            </p>
          ) : null}
        </div>
      </section>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-8 text-sm sm:flex-row sm:justify-between sm:px-6">
          <CarzaLogo size="sm" />
          <nav aria-label="Footer" className="flex gap-5">
            <Link href={LOOK_AROUND_HREF} className="hover:text-foreground">
              Feed
            </Link>
            <Link href="/reels" className="hover:text-foreground">
              Reels
            </Link>
            <Link href="/events" className="hover:text-foreground">
              Events
            </Link>
            <Link href="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
          <p>© {new Date().getFullYear()} Carza</p>
        </div>
      </footer>
    </div>
  );
}

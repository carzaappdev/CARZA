'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2Icon, MapPinIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { GarageCar, SuggestedPerson } from '@carza/db';
import { FollowButton } from '@/components/feed/follow-button';
import { UserAvatar } from '@/components/feed/user-avatar';
import { GarageEditor, type Catalog } from '@/components/garage/garage-editor';
import { Button } from '@/components/ui/button';
import { completeOnboarding, loadSuggestedFollows, setHomeZip } from '@/lib/actions/garage';
import { cn } from '@/lib/utils';

const STEPS = ['Where you drive', 'What you drive', 'Who to follow'] as const;

export function WelcomeFlow({
  garage,
  catalog,
  postalCode,
}: {
  garage: GarageCar[];
  catalog: Catalog;
  postalCode: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [zip, setZip] = useState(postalCode);
  const [people, setPeople] = useState<SuggestedPerson[] | null>(null);
  const [pending, startTransition] = useTransition();

  function goToFollows() {
    setStep(2);
    startTransition(async () => {
      const result = await loadSuggestedFollows();
      setPeople(result.ok ? result.data : []);
    });
  }

  function saveZip() {
    startTransition(async () => {
      const result = await setHomeZip({ postalCode: zip });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      if (result.data.city) toast.success(`Welcome to the ${result.data.city} car scene`);
      setStep(1);
    });
  }

  function finish() {
    startTransition(async () => {
      const result = await completeOnboarding();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.replace('/');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex gap-1.5" aria-label="Setup progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-foreground' : 'bg-muted')}
          >
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            saveZip();
          }}
        >
          <header className="flex flex-col gap-1.5">
            <h1 className="font-display text-2xl font-bold tracking-tight">Where do you drive?</h1>
            <p className="text-muted-foreground text-[15px]">
              We’ll show you meets and people nearby. Only your city appears on your profile.
            </p>
          </header>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            ZIP code
            <span className="relative">
              <MapPinIcon
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
                aria-hidden
              />
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="78701"
                className="bg-background focus-visible:ring-ring/50 h-12 w-full rounded-lg border pr-3 pl-10 text-base outline-none focus-visible:ring-[3px]"
              />
            </span>
          </label>
          <Button
            type="submit"
            size="lg"
            className="rounded-full"
            disabled={pending || zip.length !== 5}
          >
            {pending ? 'Saving…' : 'Continue'}
          </Button>
          <SkipButton onClick={() => setStep(1)} />
        </form>
      ) : step === 1 ? (
        <div className="flex flex-col gap-5">
          <header className="flex flex-col gap-1.5">
            <h1 className="font-display text-2xl font-bold tracking-tight">What do you drive?</h1>
            <p className="text-muted-foreground text-[15px]">
              Add your car, your project, or your dream car. It goes on your profile.
            </p>
          </header>
          <GarageEditor initial={garage} catalog={catalog} />
          <Button size="lg" className="rounded-full" onClick={goToFollows}>
            Continue
          </Button>
          <SkipButton onClick={goToFollows} />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <header className="flex flex-col gap-1.5">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Follow some car people
            </h1>
            <p className="text-muted-foreground text-[15px]">
              Their posts show up in your Following feed. You can change this anytime.
            </p>
          </header>
          {people === null ? (
            <div className="grid place-items-center py-10">
              <Loader2Icon
                className="text-muted-foreground size-6 animate-spin"
                aria-label="Loading"
              />
            </div>
          ) : people.length ? (
            <ul className="-mx-2 flex max-h-[50dvh] flex-col overflow-y-auto">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <UserAvatar name={p.display_name} path={p.avatar_path} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.display_name}</span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {reason(p)}
                    </span>
                  </span>
                  <FollowButton
                    userId={p.id}
                    following={false}
                    signedIn
                    className="h-9 rounded-full px-4"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground bg-muted/50 rounded-xl px-4 py-6 text-center text-sm">
              <SparklesIcon className="mx-auto mb-2 size-5" aria-hidden />
              You’re early! Post something and the first people here will find you.
            </p>
          )}
          <Button size="lg" className="rounded-full" disabled={pending} onClick={finish}>
            {pending && people !== null ? 'Finishing…' : 'Start exploring'}
          </Button>
        </div>
      )}
    </div>
  );
}

function reason(p: SuggestedPerson) {
  if (p.featured) return 'Featured on Carza';
  if (p.sharedMakes > 0) return 'Drives the same make as you';
  if (p.nearby && p.city) return `Near you · ${p.city}`;
  if (p.city) return `${p.city}, ${p.region}`;
  return `@${p.username}`;
}

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 self-center rounded-md px-2 py-1 text-sm font-medium outline-none focus-visible:ring-[3px]"
    >
      Skip for now
    </button>
  );
}

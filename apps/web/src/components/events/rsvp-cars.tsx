'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import { CheckIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { EVENT_MAX_CARS, carTitle } from '@carza/shared';
import { CarThumb } from '@/components/garage/car-thumb';
import { setRsvpCars } from '@/lib/actions/events';
import { cn } from '@/lib/utils';

type Car = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
  photoPath: string | null;
};

/** Pick up to 3 cars from your garage to bring. Only shown to guests who are going. */
export function RsvpCars({
  eventId,
  garage,
  initial,
}: {
  eventId: string;
  garage: Car[];
  initial: string[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [picked, setPicked] = useOptimistic(saved);
  const [, startTransition] = useTransition();

  if (!garage.length) {
    return (
      <Link
        href={'/account/garage' as Route}
        className="hover:bg-accent/60 focus-visible:ring-ring/50 flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm outline-none focus-visible:ring-[3px]"
      >
        <PlusIcon className="size-5" aria-hidden />
        <span>
          <span className="block font-semibold">Bringing a car?</span>
          <span className="text-muted-foreground">Add it to your garage first.</span>
        </span>
      </Link>
    );
  }

  function toggle(id: string) {
    const next = picked.includes(id) ? picked.filter((c) => c !== id) : [...picked, id];
    if (next.length > EVENT_MAX_CARS) {
      toast.error(`You can bring up to ${EVENT_MAX_CARS} cars.`);
      return;
    }
    startTransition(async () => {
      setPicked(next);
      const result = await setRsvpCars({ eventId, carIds: next });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setSaved(next);
      router.refresh();
    });
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">
        Bringing a car?{' '}
        <span className="text-muted-foreground font-normal">
          Pick up to {EVENT_MAX_CARS} from your garage.
        </span>
      </legend>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {garage.map((car) => {
          const on = picked.includes(car.id);
          return (
            <li key={car.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(car.id)}
                className={cn(
                  'focus-visible:ring-ring/50 relative flex w-full flex-col gap-1.5 rounded-xl border p-1.5 text-left outline-none focus-visible:ring-[3px]',
                  on ? 'border-foreground ring-foreground ring-1' : 'hover:bg-accent/60',
                )}
              >
                <CarThumb path={car.photoPath} className="aspect-[4/3] w-full" />
                <span className="min-w-0 px-1 pb-0.5">
                  <span className="block truncate text-sm font-semibold">
                    {car.nickname ?? carTitle(car)}
                  </span>
                  {car.nickname ? (
                    <span className="text-muted-foreground block truncate text-xs">
                      {carTitle(car)}
                    </span>
                  ) : null}
                </span>
                {on ? (
                  <span className="bg-foreground text-background absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full">
                    <CheckIcon className="size-4" aria-hidden />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

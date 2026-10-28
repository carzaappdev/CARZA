import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { CarFrontIcon, PlusIcon, WrenchIcon } from 'lucide-react';
import { getGarage } from '@carza/db';
import { GARAGE_MAX_CARS, carTitle } from '@carza/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { CarThumb } from '@/components/garage/car-thumb';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'My Garage' };

export default async function GaragePage() {
  const user = await requireUser('/account/garage');
  const cars = await getGarage(await createClient(), user.id);
  const canAdd = cars.length < GARAGE_MAX_CARS;

  return (
    <>
      <PageHeader
        title="My Garage"
        description="Your cars, their builds, and parts matched to each one."
        action={
          cars.length && canAdd ? (
            <Button asChild className="rounded-full">
              <Link href="/account/garage/new">
                <PlusIcon /> Add a car
              </Link>
            </Button>
          ) : undefined
        }
      />
      {cars.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cars.map((car) => (
            <li key={car.id}>
              <Link
                href={`/garage/${car.id}` as Route}
                className="bg-card hover:border-foreground/25 focus-visible:ring-ring/50 group flex h-full flex-col overflow-hidden rounded-2xl border outline-none transition-colors focus-visible:ring-[3px]"
              >
                <CarThumb
                  path={car.photoPath}
                  className="aspect-[4/3] w-full rounded-none transition-transform"
                />
                <span className="flex flex-1 flex-col gap-0.5 px-4 py-3">
                  <span className="font-semibold leading-snug">{carTitle(car)}</span>
                  {car.nickname ? (
                    <span className="text-muted-foreground truncate text-sm">“{car.nickname}”</span>
                  ) : null}
                  <span className="text-muted-foreground mt-auto flex items-center gap-1.5 pt-2 text-sm">
                    <WrenchIcon className="size-3.5" aria-hidden />
                    {car.modCount
                      ? `${car.modCount} ${car.modCount === 1 ? 'mod' : 'mods'}`
                      : 'Stock'}
                    <span aria-hidden>·</span>
                    <span className="text-foreground font-medium">See parts that fit</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          Icon={CarFrontIcon}
          title="Your garage is empty"
          body="Add the cars you drive, build or dream about. We’ll match parts to each one and show you other owners."
          action={
            <Button asChild className="rounded-full">
              <Link href="/account/garage/new">
                <PlusIcon /> Add your first car
              </Link>
            </Button>
          }
        />
      )}
      {!canAdd ? (
        <p className="text-muted-foreground text-center text-sm">
          Garages hold up to {GARAGE_MAX_CARS} cars.
        </p>
      ) : null}
    </>
  );
}

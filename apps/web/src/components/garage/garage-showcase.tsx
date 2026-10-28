import type { Route } from 'next';
import Link from 'next/link';
import type { GarageCar } from '@carza/db';
import { CarThumb } from './car-thumb';

/** The cars on a profile: a swipeable row of cards, each opening the car's page. */
export function GarageShowcase({ cars }: { cars: GarageCar[] }) {
  if (!cars.length) return null;
  return (
    <section aria-label="Garage" className="-mx-4">
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {cars.map((car) => (
          <li key={car.id} className="w-[220px] shrink-0 snap-start">
            <Link
              href={`/garage/${car.id}` as Route}
              className="bg-card hover:border-foreground/25 focus-visible:ring-ring/50 flex flex-col overflow-hidden rounded-2xl border outline-none transition-colors focus-visible:ring-[3px]"
            >
              <CarThumb path={car.photoPath} className="aspect-[4/3] w-full rounded-none" />
              <span className="flex flex-col px-3 py-2.5">
                <span className="truncate text-[15px] font-semibold">
                  {car.year} {car.make} {car.model}
                </span>
                <span className="text-muted-foreground truncate text-sm">
                  {car.nickname
                    ? `“${car.nickname}”`
                    : car.modCount
                      ? `${car.modCount} ${car.modCount === 1 ? 'mod' : 'mods'}`
                      : 'Stock'}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

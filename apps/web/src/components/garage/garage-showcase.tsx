import type { GarageCar } from '@carza/db';
import { CarThumb } from './car-thumb';

/** The cars on a profile: a swipeable row of cards. */
export function GarageShowcase({ cars }: { cars: GarageCar[] }) {
  if (!cars.length) return null;
  return (
    <section aria-label="Garage" className="-mx-4">
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {cars.map((car) => (
          <li
            key={car.id}
            className="bg-card flex w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border"
          >
            <CarThumb path={car.photoPath} className="aspect-[4/3] w-full rounded-none" />
            <span className="flex flex-col px-3 py-2.5">
              <span className="truncate text-[15px] font-semibold">
                {car.year} {car.make} {car.model}
              </span>
              {car.nickname ? (
                <span className="text-muted-foreground truncate text-sm">“{car.nickname}”</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { CarFrontIcon, PencilIcon } from 'lucide-react';
import {
  getCarPosts,
  getGarageCar,
  getPartsForCar,
  getReelsByAuthors,
  getSameCarOwners,
} from '@carza/db';
import { carTags, carTitle } from '@carza/shared';
import { PostCard } from '@/components/feed/post-card';
import { UserAvatar } from '@/components/feed/user-avatar';
import { CarBuild } from '@/components/garage/car-build';
import { CarThumb } from '@/components/garage/car-thumb';
import { ShareButton } from '@/components/listings/share-button';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/auth';
import { publicStorageUrl } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ id: string }> };

const loadCar = cache(async (id: string) => {
  if (!z.guid().safeParse(id).success) return null;
  return getGarageCar(await createClient(), id);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const car = await loadCar((await params).id);
  if (!car) return { title: 'Car not found' };
  const title = `${carTitle(car)}${car.nickname ? ` “${car.nickname}”` : ''}`;
  return {
    title: `${title} · @${car.owner.username}`,
    description: car.story ?? `${car.owner.display_name}’s ${carTitle(car)} on Carza.`,
    openGraph: car.photoPath
      ? { images: [{ url: publicStorageUrl('post-photos', car.photoPath) }] }
      : undefined,
  };
}

export default async function CarPage({ params }: Props) {
  const car = await loadCar((await params).id);
  if (!car) notFound();

  const user = await getUser();
  const viewerId = user?.id ?? null;
  const isOwner = viewerId === car.owner.id;
  const supabase = await createClient();
  const [parts, sameCar] = await Promise.all([
    getPartsForCar(supabase, car.id),
    getSameCarOwners(supabase, car.modelId, car.owner.id),
  ]);
  const tags = carTags(car.make, car.model);
  const [posts, reels] = await Promise.all([
    getCarPosts(supabase, tags, viewerId),
    getReelsByAuthors(supabase, [car.owner.id, ...sameCar.ownerIds], viewerId),
  ]);
  const title = carTitle(car);

  return (
    <div className="mx-auto w-full max-w-[720px] flex-1 pb-10 sm:border-x">
      {car.photos.length ? (
        <ul
          aria-label="Photos"
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pt-4 [scrollbar-width:none]"
        >
          {car.photos.map((path, i) => (
            <li
              key={path}
              className={
                car.photos.length > 1
                  ? 'bg-muted relative aspect-[4/3] w-[88%] shrink-0 snap-center overflow-hidden rounded-2xl sm:w-[80%]'
                  : 'bg-muted relative aspect-[4/3] w-full overflow-hidden rounded-2xl'
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- public storage photo */}
              <img
                src={publicStorageUrl('post-photos', path)}
                alt={i === 0 ? title : `${title}, photo ${i + 1}`}
                className="absolute inset-0 size-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 pt-4">
          <CarThumb path={null} className="aspect-[16/9] w-full rounded-2xl" />
        </div>
      )}

      <header className="flex flex-col gap-4 px-4 pt-5 pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {title}
          </h1>
          {car.nickname ? <p className="text-muted-foreground text-lg">“{car.nickname}”</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/u/${car.owner.username}` as Route}
            className="hover:bg-accent focus-visible:ring-ring/50 -ml-2 flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-3 pl-1 outline-none focus-visible:ring-[3px]"
          >
            <UserAvatar name={car.owner.display_name} path={car.owner.avatar_path} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{car.owner.display_name}</span>
              <span className="text-muted-foreground block truncate text-xs">
                @{car.owner.username}
              </span>
            </span>
          </Link>
          <div className="flex gap-2">
            {isOwner ? (
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={`/account/garage/${car.id}/edit` as Route}>
                  <PencilIcon /> Edit car
                </Link>
              </Button>
            ) : null}
            <ShareButton title={title} className="rounded-full" />
          </div>
        </div>
        {car.story ? (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{car.story}</p>
        ) : isOwner ? (
          <p className="text-muted-foreground text-sm">
            Add the story behind this car from{' '}
            <Link
              href={`/account/garage/${car.id}/edit` as Route}
              className="text-foreground font-medium underline underline-offset-4"
            >
              Edit car
            </Link>
            .
          </p>
        ) : null}
      </header>

      <CarBuild
        carId={car.id}
        car={{ year: car.year, make: car.make, model: car.model, trimLevel: car.trimLevel }}
        mods={car.mods}
        parts={parts}
        isOwner={isOwner}
      />

      {sameCar.owners.length ? (
        <section aria-labelledby="owners" className="flex flex-col gap-3 border-t px-4 py-6">
          <div>
            <h2 id="owners" className="font-display text-lg font-semibold tracking-tight">
              {car.model} owners on Carza
            </h2>
            <p className="text-muted-foreground text-sm">
              {sameCar.total === 1
                ? `1 other person has a ${car.model} in their garage.`
                : `${sameCar.total} other people have a ${car.model} in their garage.`}
            </p>
          </div>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {sameCar.owners.map((o) => (
              <li key={o.id} className="w-[84px] shrink-0">
                <Link
                  href={`/garage/${o.carId}` as Route}
                  className="focus-visible:ring-ring/50 flex flex-col items-center gap-1.5 rounded-xl p-1 text-center outline-none focus-visible:ring-[3px]"
                >
                  <UserAvatar name={o.display_name} path={o.avatar_path} large />
                  <span className="w-full truncate text-xs font-semibold">@{o.username}</span>
                  <span className="text-muted-foreground -mt-1 text-xs tabular-nums">{o.year}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="community" className="flex flex-col gap-3 border-t pt-6">
        <div className="px-4">
          <h2 id="community" className="font-display text-lg font-semibold tracking-tight">
            {car.model} on Carza
          </h2>
          <p className="text-muted-foreground text-sm">
            Reels from owners and posts tagged{' '}
            {tags.map((t, i) => (
              <span key={t}>
                {i ? ', ' : ''}
                <Link
                  href={`/t/${t}` as Route}
                  className="text-foreground font-medium hover:underline"
                >
                  #{t}
                </Link>
              </span>
            ))}
            .
          </p>
        </div>

        {reels.length ? (
          <ul className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {reels.map((r) => (
              <li key={r.id} className="w-[120px] shrink-0">
                <Link
                  href={`/reels/${r.id}` as Route}
                  className="bg-muted focus-visible:ring-ring/50 relative block aspect-[9/16] overflow-hidden rounded-xl outline-none focus-visible:ring-[3px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- reel poster from public storage */}
                  <img
                    src={publicStorageUrl('reels', r.posterPath)}
                    alt={r.caption || `Reel by @${r.author.username}`}
                    className="absolute inset-0 size-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 text-xs font-semibold text-white">
                    @{r.author.username}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {posts.length ? (
          <ul className="border-t">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} viewerId={viewerId} />
              </li>
            ))}
          </ul>
        ) : !reels.length ? (
          <div className="mx-4 flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
            <CarFrontIcon className="text-muted-foreground size-6" aria-hidden />
            <p className="font-semibold">Nothing here yet</p>
            <p className="text-muted-foreground max-w-xs text-sm">
              {isOwner
                ? `Be the first: post about your ${car.model}${tags[0] ? ` with #${tags[0]}` : ''}.`
                : `Posts from ${car.model} owners will show up here.`}
            </p>
            {isOwner ? (
              <Button asChild size="sm" className="mt-2 rounded-full">
                <Link href="/">Write a post</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

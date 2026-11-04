'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { ImagePlusIcon, Loader2Icon, StarIcon, Trash2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { GarageCar } from '@carza/db';
import { GARAGE_MAX_PHOTOS, garageYears } from '@carza/shared';
import { Button } from '@/components/ui/button';
import { addGarageCar, removeGarageCar, updateGarageCar } from '@/lib/actions/garage';
import { prepareImage } from '@/lib/images';
import { publicStorageUrl } from '@/lib/storage';
import { uploadImage } from '@/lib/upload';
import { cn } from '@/lib/utils';
import type { Catalog } from './garage-editor';

const fieldClass =
  'bg-background focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-3 text-[15px] outline-none focus-visible:ring-[3px] disabled:opacity-50';

type Photo = { path: string; preview: string };

/** Add a car to your garage, or edit one: photos, year/make/model/trim, nickname and its story. */
export function CarForm({ catalog, car }: { catalog: Catalog; car?: GarageCar }) {
  const router = useRouter();
  const [form, setForm] = useState({
    year: car ? String(car.year) : '',
    makeId: car ? String(car.makeId) : '',
    modelId: car ? String(car.modelId) : '',
    trimLevel: car?.trimLevel ?? '',
    nickname: car?.nickname ?? '',
    story: car?.story ?? '',
  });
  const [photos, setPhotos] = useState<Photo[]>(
    () =>
      car?.photos.map((path) => ({ path, preview: publicStorageUrl('post-photos', path) })) ?? [],
  );
  const [uploading, setUploading] = useState(0);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const years = useMemo(() => garageYears(), []);
  const models = useMemo(
    () => catalog.models.filter((m) => String(m.make_id) === form.makeId),
    [catalog.models, form.makeId],
  );
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function addPhotos(files: File[]) {
    const room = GARAGE_MAX_PHOTOS - photos.length - uploading;
    if (files.length > room) toast.message(`Up to ${GARAGE_MAX_PHOTOS} photos per car.`);
    const batch = files.slice(0, Math.max(room, 0));
    setUploading((n) => n + batch.length);
    // One at a time keeps the order the person picked them in.
    for (const file of batch) {
      try {
        const image = await prepareImage(file);
        const result = await uploadImage('post-photos', image.blob);
        if ('error' in result) throw new Error(result.error);
        setPhotos((all) => [...all, { path: result.path, preview: image.previewUrl }]);
      } catch (e) {
        toast.error(
          e instanceof Error && e.message.length < 120 ? e.message : 'That photo couldn’t be used.',
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function save() {
    startTransition(async () => {
      const values = { ...form, photoPaths: photos.map((p) => p.path) };
      const result = car
        ? await updateGarageCar({ ...values, carId: car.id })
        : await addGarageCar(values);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const id = car?.id ?? (result.data as { id: string }).id;
      toast.success(car ? 'Saved' : 'Added to your garage');
      router.push(`/garage/${id}` as Route);
      router.refresh();
    });
  }

  function remove() {
    if (!car) return;
    if (!window.confirm('Remove this car, its photos and its build list from your garage?')) return;
    startTransition(async () => {
      const result = await removeGarageCar({ carId: car.id });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success('Removed from your garage');
      router.push('/account/garage');
      router.refresh();
    });
  }

  const busy = pending || uploading > 0;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">
          Photos{' '}
          <span className="text-muted-foreground font-normal">
            · up to {GARAGE_MAX_PHOTOS}, the first is the cover
          </span>
        </legend>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, i) => (
            <li
              key={photo.path}
              className="bg-muted relative aspect-square overflow-hidden rounded-xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob preview or public storage */}
              <img src={photo.preview} alt="" className="absolute inset-0 size-full object-cover" />
              {i === 0 ? (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                  Cover
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPhotos((all) => [photo, ...all.filter((p) => p !== photo)])}
                  aria-label={`Make photo ${i + 1} the cover`}
                  className="absolute bottom-1 left-1 grid size-9 place-items-center rounded-full bg-black/55 text-white outline-none hover:bg-black/75 focus-visible:ring-[3px] focus-visible:ring-white/60"
                >
                  <StarIcon className="size-4" aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => setPhotos((all) => all.filter((p) => p !== photo))}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute top-1 right-1 grid size-9 place-items-center rounded-full bg-black/55 text-white outline-none hover:bg-black/75 focus-visible:ring-[3px] focus-visible:ring-white/60"
              >
                <XIcon className="size-4" aria-hidden />
              </button>
            </li>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <li
              key={`uploading-${i}`}
              className="bg-muted grid aspect-square place-items-center rounded-xl"
            >
              <Loader2Icon
                className="text-muted-foreground size-6 animate-spin"
                aria-label="Uploading"
              />
            </li>
          ))}
          {photos.length + uploading < GARAGE_MAX_PHOTOS ? (
            <li>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="bg-muted/60 hover:bg-muted text-muted-foreground focus-visible:ring-ring/50 flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs font-medium outline-none focus-visible:ring-[3px]"
              >
                <ImagePlusIcon className="size-6" aria-hidden />
                Add photos
              </button>
            </li>
          ) : null}
        </ul>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            void addPhotos(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Year
          <select
            required
            className={fieldClass}
            value={form.year}
            onChange={(e) => set('year')(e.target.value)}
          >
            <option value="">Year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Make
          <select
            required
            className={fieldClass}
            value={form.makeId}
            onChange={(e) => setForm((f) => ({ ...f, makeId: e.target.value, modelId: '' }))}
          >
            <option value="">Make</option>
            {catalog.makes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Model
          <select
            required
            className={fieldClass}
            value={form.modelId}
            disabled={!form.makeId}
            onChange={(e) => set('modelId')(e.target.value)}
          >
            <option value="">Model</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Trim <span className="sr-only">(optional)</span>
          <input
            className={fieldClass}
            value={form.trimLevel}
            maxLength={40}
            placeholder="Club, Sport, GT…"
            onChange={(e) => set('trimLevel')(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Nickname <span className="sr-only">(optional)</span>
          <input
            className={fieldClass}
            value={form.nickname}
            maxLength={40}
            placeholder="Blue Steel"
            onChange={(e) => set('nickname')(e.target.value)}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        <span className="flex justify-between">
          The story <span className="sr-only">(optional)</span>
          <span
            className={cn(
              'text-muted-foreground font-normal tabular-nums',
              form.story.length > 950 && 'text-destructive',
            )}
          >
            {form.story.length}/1000
          </span>
        </span>
        <textarea
          className={cn(fieldClass, 'h-auto min-h-28 resize-y py-2.5 leading-relaxed')}
          value={form.story}
          maxLength={1000}
          placeholder="How you found it, what you’ve done, where it’s headed."
          onChange={(e) => set('story')(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          size="lg"
          className="rounded-full"
          disabled={busy || !form.year || !form.makeId || !form.modelId}
        >
          {pending
            ? 'Saving…'
            : uploading
              ? 'Uploading photos…'
              : car
                ? 'Save changes'
                : 'Add to garage'}
        </Button>
        {car ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive rounded-full"
            disabled={busy}
            onClick={remove}
          >
            <Trash2Icon /> Remove from garage
          </Button>
        ) : null}
      </div>
    </form>
  );
}

'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { ImagePlusIcon, Loader2Icon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { GarageCar } from '@carza/db';
import { GARAGE_MAX_CARS, garageYears } from '@carza/shared';
import { Button } from '@/components/ui/button';
import { addGarageCar, removeGarageCar } from '@/lib/actions/garage';
import { prepareImage } from '@/lib/images';
import { uploadImage } from '@/lib/upload';
import { CarThumb } from './car-thumb';

export type Catalog = {
  makes: { id: number; name: string }[];
  models: { id: number; make_id: number; name: string }[];
};

const fieldClass =
  'bg-background focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-3 text-[15px] outline-none focus-visible:ring-[3px]';

const empty = { year: '', makeId: '', modelId: '', nickname: '' };

/** Quick add and remove for the cars on your profile (first-run setup). */
export function GarageEditor({ initial, catalog }: { initial: GarageCar[]; catalog: Catalog }) {
  const [cars, setCars] = useState(initial);
  const [adding, setAdding] = useState(initial.length === 0);
  const [form, setForm] = useState(empty);
  const [photo, setPhoto] = useState<{ path: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const years = useMemo(() => garageYears(), []);
  const models = useMemo(
    () => catalog.models.filter((m) => String(m.make_id) === form.makeId),
    [catalog.models, form.makeId],
  );

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const image = await prepareImage(file);
      const result = await uploadImage('post-photos', image.blob);
      if ('error' in result) throw new Error(result.error);
      setPhoto({ path: result.path, preview: image.previewUrl });
    } catch (e) {
      toast.error(
        e instanceof Error && e.message.length < 120 ? e.message : 'That photo couldn’t be used.',
      );
    } finally {
      setUploading(false);
    }
  }

  function save() {
    startTransition(async () => {
      const result = await addGarageCar({ ...form, photoPaths: photo ? [photo.path] : [] });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setCars((all) => [
        ...all,
        {
          id: result.data.id,
          year: Number(form.year),
          makeId: Number(form.makeId),
          modelId: Number(form.modelId),
          make: catalog.makes.find((m) => String(m.id) === form.makeId)?.name ?? '',
          model: models.find((m) => String(m.id) === form.modelId)?.name ?? '',
          trimLevel: null,
          nickname: form.nickname.trim() || null,
          story: null,
          photoPath: photo?.path ?? null,
          photos: photo ? [photo.path] : [],
          modCount: 0,
        },
      ]);
      setForm(empty);
      setPhoto(null);
      setAdding(false);
      toast.success('Added to your garage');
    });
  }

  function remove(car: GarageCar) {
    if (!window.confirm(`Remove the ${car.year} ${car.make} ${car.model} from your garage?`))
      return;
    startTransition(async () => {
      const result = await removeGarageCar({ carId: car.id });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setCars((all) => all.filter((c) => c.id !== car.id));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {cars.length ? (
        <ul className="flex flex-col gap-2">
          {cars.map((car) => (
            <li key={car.id} className="flex items-center gap-3 rounded-xl border p-2 pr-1">
              <CarThumb path={car.photoPath} className="size-14" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {car.year} {car.make} {car.model}
                </span>
                {car.nickname ? (
                  <span className="text-muted-foreground block truncate text-sm">
                    “{car.nickname}”
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => remove(car)}
                disabled={pending}
                aria-label={`Remove ${car.year} ${car.make} ${car.model}`}
                className="text-muted-foreground hover:text-destructive hover:bg-accent focus-visible:ring-ring/50 grid size-11 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
              >
                <Trash2Icon className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              aria-label={photo ? 'Change photo' : 'Add a photo'}
              className="bg-muted/60 hover:bg-muted focus-visible:ring-ring/50 relative grid size-[88px] shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed outline-none focus-visible:ring-[3px]"
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img
                  src={photo.preview}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <ImagePlusIcon className="text-muted-foreground size-6" aria-hidden />
              )}
              {uploading ? (
                <span className="absolute inset-0 grid place-items-center bg-black/40">
                  <Loader2Icon className="size-6 animate-spin text-white" aria-hidden />
                </span>
              ) : null}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void pickPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
              Year
              <select
                className={fieldClass}
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              >
                <option value="">Year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Make
              <select
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
                className={fieldClass}
                value={form.modelId}
                disabled={!form.makeId}
                onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
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
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Nickname (optional)
            <input
              className={fieldClass}
              value={form.nickname}
              maxLength={40}
              placeholder="Blue Steel"
              onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
            />
          </label>
          <div className="flex gap-2">
            <Button
              className="flex-1 rounded-full"
              disabled={pending || uploading || !form.year || !form.makeId || !form.modelId}
              onClick={save}
            >
              {pending ? 'Adding…' : 'Add to garage'}
            </Button>
            {cars.length ? (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Cancel"
                onClick={() => {
                  setAdding(false);
                  setForm(empty);
                  setPhoto(null);
                }}
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
        </div>
      ) : cars.length < GARAGE_MAX_CARS ? (
        <Button variant="outline" className="rounded-full" onClick={() => setAdding(true)}>
          <PlusIcon /> Add another car
        </Button>
      ) : null}
    </div>
  );
}

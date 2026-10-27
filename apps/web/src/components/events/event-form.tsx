'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { ImagePlusIcon, Loader2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITS } from '@carza/shared';
import { Button } from '@/components/ui/button';
import { createEvent, updateEvent } from '@/lib/actions/events';
import { prepareImage } from '@/lib/images';
import { publicStorageUrl } from '@/lib/storage';
import { uploadImage } from '@/lib/upload';
import { cn } from '@/lib/utils';

export type EventFormValues = {
  title: string;
  description: string;
  startsAt: string | null;
  endsAt: string | null;
  venueName: string;
  address: string;
  postalCode: string;
  capacity: string;
  coverPath: string | null;
};

const inputClass =
  'bg-background focus-visible:ring-ring/50 aria-[invalid=true]:border-destructive h-11 w-full rounded-lg border px-3 text-[15px] outline-none focus-visible:ring-[3px]';

/** ISO instant → the browser's local "YYYY-MM-DDTHH:mm" for a datetime-local input. */
function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Host or edit an event. Times are entered in the host's own timezone, which is saved with the event. */
export function EventForm({ eventId, initial }: { eventId?: string; initial: EventFormValues }) {
  const router = useRouter();
  const [v, setV] = useState({
    ...initial,
    startsAt: toLocalInput(initial.startsAt),
    endsAt: toLocalInput(initial.endsAt),
  });
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));

  async function pickCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const image = await prepareImage(file);
      setCoverPreview(image.previewUrl);
      const result = await uploadImage('post-photos', image.blob);
      if ('error' in result) throw new Error(result.error);
      set({ coverPath: result.path });
    } catch (e) {
      setCoverPreview(null);
      toast.error(
        e instanceof Error && e.message.length < 120 ? e.message : 'That photo couldn’t be used.',
      );
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const event = {
      title: v.title,
      description: v.description,
      startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : '',
      endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      venueName: v.venueName,
      address: v.address,
      postalCode: v.postalCode,
      capacity: v.capacity ? Number(v.capacity) : null,
      coverPath: v.coverPath,
    };
    startTransition(async () => {
      const result = eventId ? await updateEvent({ eventId, event }) : await createEvent(event);
      if (!result.ok) {
        setErrors(result.error.fieldErrors ?? {});
        toast.error(result.error.message);
        return;
      }
      toast.success(eventId ? 'Event updated' : 'Your event is live');
      router.push(`/events/${result.data.id}` as Route);
      router.refresh();
    });
  }

  const field = (name: keyof typeof v, label: string, input: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {input}
      {errors[name]?.[0] ? (
        <p id={`${name}-error`} className="text-destructive text-sm">
          {errors[name][0]}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-sm">{hint}</p>
      ) : null}
    </div>
  );
  const a11y = (name: string) => ({
    id: name,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  const coverSrc =
    coverPreview ?? (v.coverPath ? publicStorageUrl('post-photos', v.coverPath) : null);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className={cn(
            'focus-visible:ring-ring/50 relative grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-2xl outline-none focus-visible:ring-[3px]',
            coverSrc ? 'bg-muted' : 'bg-muted/60 hover:bg-muted border-2 border-dashed',
          )}
          aria-label={coverSrc ? 'Change cover photo' : 'Add a cover photo'}
        >
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview or already-public photo
            <img src={coverSrc} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="text-muted-foreground flex flex-col items-center gap-2 text-sm font-medium">
              <ImagePlusIcon className="size-7" aria-hidden />
              Add a cover photo
            </span>
          )}
          {uploading ? (
            <span className="absolute inset-0 grid place-items-center bg-black/40">
              <Loader2Icon className="size-7 animate-spin text-white" aria-label="Uploading" />
            </span>
          ) : null}
        </button>
        {coverSrc && !uploading ? (
          <button
            type="button"
            aria-label="Remove cover photo"
            onClick={() => {
              setCoverPreview(null);
              set({ coverPath: null });
            }}
            className="focus-visible:ring-ring/50 absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-black/70 text-white outline-none focus-visible:ring-[3px]"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          accept={LIMITS.imageMimeTypes.join(',')}
          hidden
          onChange={(e) => {
            void pickCover(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {field(
        'title',
        'Event name',
        <input
          {...a11y('title')}
          className={inputClass}
          value={v.title}
          maxLength={100}
          placeholder="Sunday Cars & Coffee"
          onChange={(e) => set({ title: e.target.value })}
        />,
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {field(
          'startsAt',
          'Starts',
          <input
            {...a11y('startsAt')}
            type="datetime-local"
            className={inputClass}
            value={v.startsAt}
            onChange={(e) => set({ startsAt: e.target.value })}
          />,
        )}
        {field(
          'endsAt',
          'Ends (optional)',
          <input
            {...a11y('endsAt')}
            type="datetime-local"
            className={inputClass}
            value={v.endsAt}
            min={v.startsAt || undefined}
            onChange={(e) => set({ endsAt: e.target.value })}
          />,
        )}
      </div>

      {field(
        'venueName',
        'Where',
        <input
          {...a11y('venueName')}
          className={inputClass}
          value={v.venueName}
          maxLength={100}
          placeholder="Place name, e.g. Fleet Street Coffee"
          onChange={(e) => set({ venueName: e.target.value })}
        />,
      )}

      <div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
        {field(
          'address',
          'Street address (optional)',
          <input
            {...a11y('address')}
            className={inputClass}
            value={v.address}
            maxLength={200}
            autoComplete="street-address"
            placeholder="1200 Main St"
            onChange={(e) => set({ address: e.target.value })}
          />,
          'Shown publicly. Leave it out to share it later.',
        )}
        {field(
          'postalCode',
          'ZIP code',
          <input
            {...a11y('postalCode')}
            className={inputClass}
            value={v.postalCode}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="78701"
            onChange={(e) => set({ postalCode: e.target.value.replace(/\D/g, '') })}
          />,
        )}
      </div>

      {field(
        'description',
        'Details',
        <textarea
          {...a11y('description')}
          rows={5}
          maxLength={2000}
          className={`${inputClass} h-auto py-2.5 leading-[1.4]`}
          placeholder="What’s the plan? Who’s it for? Anything people should bring?"
          value={v.description}
          onChange={(e) => set({ description: e.target.value })}
        />,
      )}

      {field(
        'capacity',
        'Spots (optional)',
        <input
          {...a11y('capacity')}
          className={`${inputClass} sm:w-40`}
          value={v.capacity}
          inputMode="numeric"
          placeholder="No limit"
          onChange={(e) => set({ capacity: e.target.value.replace(/\D/g, '').slice(0, 5) })}
        />,
        'RSVPs close when it’s full. You count as one.',
      )}

      <Button
        type="submit"
        size="lg"
        className="h-12 rounded-xl text-base"
        disabled={pending || uploading}
      >
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {eventId ? 'Save changes' : 'Publish event'}
      </Button>
    </form>
  );
}

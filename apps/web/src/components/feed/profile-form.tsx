'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { CameraIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITS } from '@carza/shared';
import { Button } from '@/components/ui/button';
import { updateProfile } from '@/lib/actions/profile';
import { prepareImage } from '@/lib/images';
import { uploadImage } from '@/lib/upload';
import { UserAvatar } from './user-avatar';

type Fields = { displayName: string; username: string; bio: string; avatarPath: string | null };

const inputClass =
  'bg-background focus-visible:ring-ring/50 aria-[invalid=true]:border-destructive h-11 w-full rounded-lg border px-3 text-[15px] outline-none focus-visible:ring-[3px]';

export function ProfileForm({ initial }: { initial: Fields }) {
  const router = useRouter();
  const [fields, setFields] = useState(initial);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Fields>) => setFields((f) => ({ ...f, ...patch }));

  async function pickAvatar(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const image = await prepareImage(file);
      setPreview(image.previewUrl);
      const result = await uploadImage('avatars', image.blob);
      if ('error' in result) throw new Error(result.error);
      set({ avatarPath: result.path });
    } catch (e) {
      setPreview(null);
      toast.error(
        e instanceof Error && e.message.length < 120 ? e.message : 'That photo couldn’t be used.',
      );
    } finally {
      setUploading(false);
    }
  }

  const fieldError = (name: keyof Fields) =>
    errors[name]?.[0] ? (
      <p id={`${name}-error`} className="text-destructive text-sm">
        {errors[name][0]}
      </p>
    ) : null;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateProfile(fields);
          if (!result.ok) {
            setErrors(result.error.fieldErrors ?? {});
            toast.error(result.error.message);
            return;
          }
          setErrors({});
          toast.success('Profile saved');
          router.push(`/u/${result.data.username}` as Route);
          router.refresh();
        });
      }}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="focus-visible:ring-ring/50 relative rounded-full outline-none focus-visible:ring-[3px]"
          aria-label="Change profile photo"
          disabled={uploading}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={preview} alt="" className="size-20 rounded-full object-cover" />
          ) : (
            <UserAvatar name={fields.displayName || '?'} path={fields.avatarPath} large />
          )}
          <span className="bg-foreground text-background absolute -right-0.5 -bottom-0.5 grid size-7 place-items-center rounded-full border-2 border-[var(--background)]">
            {uploading ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <CameraIcon className="size-3.5" />
            )}
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={LIMITS.imageMimeTypes.join(',')}
          hidden
          onChange={(e) => {
            void pickAvatar(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <p className="text-muted-foreground text-sm">
          A clear photo of you or your car works best.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className="text-sm font-medium">
          Name
        </label>
        <input
          id="displayName"
          className={inputClass}
          value={fields.displayName}
          maxLength={60}
          autoComplete="name"
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={errors.displayName ? 'displayName-error' : undefined}
          onChange={(e) => set({ displayName: e.target.value })}
        />
        {fieldError('displayName')}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-medium">
          Username
        </label>
        <div className="relative">
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
            @
          </span>
          <input
            id="username"
            className={`${inputClass} pl-7`}
            value={fields.username}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={Boolean(errors.username)}
            aria-describedby={errors.username ? 'username-error' : undefined}
            onChange={(e) => set({ username: e.target.value.toLowerCase() })}
          />
        </div>
        {fieldError('username')}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium">
          Bio
        </label>
        <textarea
          id="bio"
          rows={3}
          maxLength={500}
          className={`${inputClass} h-auto py-2.5 leading-[1.4]`}
          placeholder="What do you drive? What are you building?"
          value={fields.bio}
          aria-invalid={Boolean(errors.bio)}
          onChange={(e) => set({ bio: e.target.value })}
        />
        {fieldError('bio')}
      </div>

      <Button type="submit" className="rounded-xl" size="lg" disabled={pending || uploading}>
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        Save
      </Button>
    </form>
  );
}

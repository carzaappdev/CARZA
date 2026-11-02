'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setHomeZip } from '@/lib/actions/garage';

/** Settings: change the home ZIP that places you (nearby events, the city on your profile). */
export function HomeZip({ initial }: { initial: string | null }) {
  const router = useRouter();
  const [zip, setZip] = useState(initial ?? '');
  const [pending, startTransition] = useTransition();
  const valid = /^\d{5}$/.test(zip);

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        startTransition(async () => {
          const result = await setHomeZip({ postalCode: zip });
          if (!result.ok) {
            toast.error(result.error.message);
            return;
          }
          toast.success(result.data.city ? `Home set to ${result.data.city}` : 'Home ZIP saved');
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Home ZIP code
        <input
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          placeholder="e.g. 78701"
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
          className="bg-background focus-visible:ring-ring/50 h-11 w-36 rounded-lg border px-3 text-[15px] font-normal outline-none focus-visible:ring-[3px]"
        />
      </label>
      <Button
        type="submit"
        variant="outline"
        className="h-11 rounded-xl"
        disabled={!valid || zip === initial || pending}
      >
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        Save
      </Button>
    </form>
  );
}

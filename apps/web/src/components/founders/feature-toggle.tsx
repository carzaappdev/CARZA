'use client';

import { useState, useTransition } from 'react';
import { StarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setFeatured } from '@/lib/actions/moderation';

/** Admin-only switch for featuring someone in "who to follow". */
export function FeatureToggle({ userId, featured }: { userId: string; featured: boolean }) {
  const [on, setOn] = useState(featured);
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="self-start rounded-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setFeatured({ userId, featured: !on });
          if (!result.ok) {
            toast.error(result.error.message);
            return;
          }
          setOn(result.data.featured);
          toast.success(result.data.featured ? 'Featured for new members' : 'No longer featured');
        })
      }
    >
      <StarIcon className={on ? 'fill-current' : undefined} />
      {on ? 'Featured' : 'Feature'}
    </Button>
  );
}

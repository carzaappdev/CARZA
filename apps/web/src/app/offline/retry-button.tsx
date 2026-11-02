'use client';

import { RotateCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RetryButton() {
  return (
    <Button size="lg" onClick={() => window.location.reload()}>
      <RotateCwIcon aria-hidden /> Try again
    </Button>
  );
}

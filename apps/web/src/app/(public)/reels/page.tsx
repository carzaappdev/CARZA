import type { Metadata } from 'next';
import { ClapperboardIcon } from 'lucide-react';
import { ComingSoon } from '@/components/feedback/coming-soon';

export const metadata: Metadata = { title: 'Reels' };

export default function ReelsPage() {
  return (
    <ComingSoon
      Icon={ClapperboardIcon}
      title="Reels"
      body="Short, full-screen videos of cars near you. Swipe through launches, walkarounds and builds."
    />
  );
}

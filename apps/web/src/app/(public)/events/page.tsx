import type { Metadata } from 'next';
import { CalendarDaysIcon } from 'lucide-react';
import { ComingSoon } from '@/components/feedback/coming-soon';

export const metadata: Metadata = { title: 'Events' };

export default function EventsPage() {
  return (
    <ComingSoon
      Icon={CalendarDaysIcon}
      title="Events"
      body="Find car meets, cruises and shows near you, or host your own and see who’s coming."
    />
  );
}

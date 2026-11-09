import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AgeForm } from '@/components/auth/age-form';
import { getViewer } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Your date of birth', robots: { index: false } };

export default async function AgePage() {
  // Signed out is fine: someone just turned away lands here signed out and sees the "can't join" screen.
  const viewer = await getViewer();
  if (viewer?.ageGroup) redirect('/');
  return <AgeForm />;
}

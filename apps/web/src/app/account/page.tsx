import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/viewer';

export default async function AccountPage() {
  const viewer = await getViewer();
  redirect((viewer?.username ? `/u/${viewer.username}` : '/account/settings') as Route);
}

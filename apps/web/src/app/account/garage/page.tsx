import type { Metadata } from 'next';
import { getGarage } from '@carza/db';
import { GarageEditor } from '@/components/garage/garage-editor';
import { PageHeader } from '@/components/layout/page-header';
import { requireUser } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Your garage' };

export default async function GaragePage() {
  const user = await requireUser('/account/garage');
  const [garage, catalog] = await Promise.all([
    getGarage(await createClient(), user.id),
    getCatalog(),
  ]);
  return (
    <>
      <PageHeader
        title="Your garage"
        description="The cars you drive, build or dream about. They show on your profile."
      />
      <GarageEditor initial={garage} catalog={catalog} />
    </>
  );
}

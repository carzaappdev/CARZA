import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getGarageCar } from '@carza/db';
import { carTitle } from '@carza/shared';
import { CarForm } from '@/components/garage/car-form';
import { PageHeader } from '@/components/layout/page-header';
import { requireUser } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit car' };

export default async function EditCarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/account/garage/${id}/edit`);
  if (!z.guid().safeParse(id).success) notFound();
  const [car, catalog] = await Promise.all([getGarageCar(await createClient(), id), getCatalog()]);
  if (!car || car.owner.id !== user.id) notFound();
  return (
    <>
      <PageHeader title="Edit car" description={carTitle(car)} />
      <CarForm catalog={catalog} car={car} />
    </>
  );
}

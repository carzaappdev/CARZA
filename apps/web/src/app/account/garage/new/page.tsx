import type { Metadata } from 'next';
import { CarForm } from '@/components/garage/car-form';
import { PageHeader } from '@/components/layout/page-header';
import { requireUser } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Add a car' };

export default async function NewCarPage() {
  await requireUser('/account/garage/new');
  return (
    <>
      <PageHeader title="Add a car" description="We’ll match parts and other owners to it." />
      <CarForm catalog={await getCatalog()} />
    </>
  );
}

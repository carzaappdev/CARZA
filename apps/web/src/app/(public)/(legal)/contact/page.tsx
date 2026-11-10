import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL, LEGAL_ADDRESS, LEGAL_NAME } from '@/components/legal/legal';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';
import { LegalRequestForm } from '@/components/legal/legal-request-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Reach the Carza team about privacy, safety, legal requests or anything else.',
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      current="/contact"
      intro="For privacy requests, safety concerns, questions from parents, law enforcement requests, accessibility problems, or anything else. You don’t need an account."
    >
      <LegalSection title="The fastest route">
        <ul>
          <li>
            Something on Carza breaks the rules: use <strong>Report</strong> on the post, reel,
            event, message or profile.
          </li>
          <li>
            An intimate image of you: <Link href="/takedown">Remove an intimate image</Link>.
          </li>
          <li>
            Your copyrighted work: <Link href="/copyright">Copyright</Link>.
          </li>
          <li>Your data: download it or delete your account from Settings at any time.</li>
        </ul>
        <p>
          {LEGAL_NAME}
          {LEGAL_ADDRESS ? `, ${LEGAL_ADDRESS}` : ''}
          {CONTACT_EMAIL ? (
            <>
              {' · '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </>
          ) : null}
        </p>
        <p>If someone is in immediate danger, call 911 first.</p>
      </LegalSection>
      <LegalSection title="Write to us">
        <LegalRequestForm
          kinds={[
            { value: 'privacy', label: 'Privacy or my data' },
            {
              value: 'other',
              label: 'Safety, a child’s account, law enforcement or something else',
            },
          ]}
          whereLabel="What is it about?"
          whereHint="A link, a username, or a short subject."
          statementLabel="Your message"
          confirmText="The information in this request is accurate to the best of my knowledge."
        />
      </LegalSection>
    </LegalPage>
  );
}

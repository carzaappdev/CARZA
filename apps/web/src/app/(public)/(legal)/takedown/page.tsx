import type { Metadata } from 'next';
import { CONTACT_EMAIL } from '@/components/legal/legal';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';
import { LegalRequestForm } from '@/components/legal/legal-request-form';

export const metadata: Metadata = {
  title: 'Remove an intimate image',
  description:
    'Ask Carza to remove an intimate image or video of you that was shared without your consent. No account needed. We act within 48 hours.',
};

export default function TakedownPage() {
  return (
    <LegalPage
      title="Remove an intimate image"
      current="/takedown"
      intro="If an intimate photo or video of you, real or digitally created, was posted on Carza without your consent, tell us here and we will remove it. You don’t need an account."
    >
      <LegalSection title="What happens">
        <ul>
          <li>
            We remove the image or video within <strong>48 hours</strong> of receiving a valid
            request, and make reasonable efforts to remove copies of it.
          </li>
          <li>We don’t tell the person who posted it who made the request.</li>
          <li>
            Someone you trust can send the request for you, as long as you have authorized them.
          </li>
          <li>
            If you have a Carza account, you can also use <strong>Report</strong> on the post and
            choose “Intimate image shared without consent”.
          </li>
          {CONTACT_EMAIL ? (
            <li>
              You can also email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the
              same details.
            </li>
          ) : null}
        </ul>
        <p>
          If you are under 18, or the image shows someone under 18, please also report it to the
          National Center for Missing &amp; Exploited Children at{' '}
          <a href="https://takeitdown.ncmec.org" rel="noopener noreferrer">
            takeitdown.ncmec.org
          </a>
          . If you are in danger, call 911.
        </p>
      </LegalSection>
      <LegalSection title="Send a request">
        <LegalRequestForm
          kinds={[{ value: 'intimate_image', label: 'Intimate image removal' }]}
          whereLabel="Where is it on Carza?"
          whereHint="Paste the link to the post, reel or profile. If you don’t have a link, describe it and the account that posted it."
          statementLabel="Anything that helps us find and confirm it"
          statementHint="For example: what the image shows, and when it was posted. Please don’t attach or paste the image itself."
          confirmText="I am the person shown (or I’m authorized to act for them), the image is an intimate depiction, and I have a good-faith belief it was published without consent."
        />
      </LegalSection>
    </LegalPage>
  );
}

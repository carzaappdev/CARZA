import type { Metadata } from 'next';
import { CONTACT_EMAIL, LEGAL_ADDRESS, LEGAL_NAME } from '@/components/legal/legal';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';
import { LegalRequestForm } from '@/components/legal/legal-request-form';

export const metadata: Metadata = {
  title: 'Copyright',
  description:
    'How to report copyright infringement on Carza, how to respond if your content was removed, and our repeat-infringer policy.',
};

export default function CopyrightPage() {
  return (
    <LegalPage
      title="Copyright"
      current="/copyright"
      intro="Carza respects creators’ rights and follows the Digital Millennium Copyright Act (DMCA). If your work was posted here without permission, tell us and we’ll take it down."
    >
      <LegalSection title="Our copyright agent">
        <p>Send copyright notices to our designated agent using the form below, or write to:</p>
        <p>
          Copyright Agent, {LEGAL_NAME}
          {LEGAL_ADDRESS ? (
            <>
              <br />
              {LEGAL_ADDRESS}
            </>
          ) : null}
          {CONTACT_EMAIL ? (
            <>
              <br />
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </>
          ) : null}
        </p>
      </LegalSection>
      <LegalSection title="What a notice needs">
        <ul>
          <li>Your name and contact details, and your signature (typed is fine).</li>
          <li>The work you own, or a link to it.</li>
          <li>Where the copy is on Carza: the link to the post, reel or profile.</li>
          <li>
            A statement that you believe in good faith the use isn’t authorized by the owner, its
            agent or the law.
          </li>
          <li>
            A statement that the notice is accurate and, under penalty of perjury, that you are the
            owner or authorized to act for the owner.
          </li>
        </ul>
        <p>
          Knowingly sending a false notice can make you liable for damages. If you’re not sure
          whether something is infringing, consider getting advice first.
        </p>
      </LegalSection>
      <LegalSection title="If your content was removed">
        <p>
          We tell the person who posted it. If you think the removal was a mistake or the content
          was misidentified, send a counter-notice with the form below (choose “Counter-notice”).
          Include what was removed and where it was, a statement under penalty of perjury that you
          believe it was removed by mistake, your name, address and phone number, and that you
          consent to the jurisdiction of the federal court for your district and will accept service
          from the person who sent the notice. We may restore the content 10 to 14 business days
          later unless they tell us they have gone to court.
        </p>
      </LegalSection>
      <LegalSection title="Repeat infringers">
        <p>
          We keep a record of removals. Accounts that repeatedly infringe are suspended or closed.
        </p>
      </LegalSection>
      <LegalSection title="Send a notice">
        <LegalRequestForm
          kinds={[
            { value: 'copyright', label: 'Report infringement of my work' },
            { value: 'copyright_counter', label: 'Counter-notice: my content was removed' },
          ]}
          whereLabel="Links"
          whereHint="The link to the content on Carza, and a link to (or description of) the original work."
          statementLabel="Your statement"
          statementHint="Describe the work and why the use isn’t authorized. For a counter-notice, add your address and phone number and the statements listed above."
          confirmText="I state in good faith, and under penalty of perjury, that this notice is accurate and that I am the owner of the rights involved or authorized to act for the owner (or, for a counter-notice, that the content was removed by mistake or misidentification)."
        />
      </LegalSection>
    </LegalPage>
  );
}

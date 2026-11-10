import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The rules for using Carza.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      current="/terms"
      intro="These terms are the agreement between you and Carza when you use the Carza website and apps. Please read them. By creating an account or using Carza, you agree to them."
    >
      <LegalSection title="1. Who can use Carza">
        <p>
          You must be at least 13 years old to use Carza, and old enough to agree to these terms
          where you live. We ask for your date of birth when you join, and you must give your real
          one. If you are under 18, a parent or guardian should review these terms with you.
        </p>
        <p>
          Carza works differently for members aged 13 to 17: they can’t exchange direct messages
          with adults, can’t host events, don’t see events marked 18+, and don’t get alerts at
          night. Getting around these rules, or giving a false age, is a reason to close an account.
        </p>
        <p>
          Carza is offered in the United States only. If you use it from somewhere else, you are
          responsible for following your local law.
        </p>
        <p>
          You can only have one personal account, and you must not use Carza if we have removed you
          before.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <p>
          Keep your sign-in details safe and give accurate information. You are responsible for what
          happens on your account. Tell us right away if you think someone else is using it.
        </p>
      </LegalSection>

      <LegalSection title="3. Your content">
        <p>
          You own the posts, photos, videos, comments and events you share. To run Carza, you give
          us a worldwide, non-exclusive, royalty-free license to host, store, show, copy, resize and
          share your content inside Carza and in links and previews of it. This license ends when
          you delete the content, except for copies kept for a limited time in backups or where the
          law or a safety investigation requires us to keep it.
        </p>
        <p>
          Only share content you have the right to share. You must follow our{' '}
          <Link href="/guidelines" className="font-semibold underline underline-offset-4">
            Community Guidelines
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="4. Events">
        <p>
          Anyone can host an event on Carza. Carza does not organize, run, supervise or insure
          events, and is not a party to anything between hosts and attendees. Hosts are responsible
          for their event: permission to use the venue, any permits, safety, and following the law.
          Attendees go at their own risk.
        </p>
        <p>
          Street racing, takeovers, burnouts on public roads, and any event that breaks traffic laws
          are not allowed and will be removed.
        </p>
      </LegalSection>

      <LegalSection title="5. Things you must not do">
        <ul>
          <li>Break the law, or help someone else break it.</li>
          <li>Harass, threaten, impersonate or scam people.</li>
          <li>Post spam, or use bots, scrapers or automation without our written permission.</li>
          <li>
            Try to get around our security, rate limits, blocks or moderation, or access accounts or
            data that are not yours.
          </li>
          <li>Upload viruses or anything designed to harm Carza or its users.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Moderation">
        <p>
          We may remove content, limit features, or suspend or close accounts that break these terms
          or our guidelines, or that put people at risk. We try to be fair and consistent, but we
          are not required to host any particular content. You can report anything with the Report
          option in the app.
        </p>
      </LegalSection>

      <LegalSection title="7. Copyright">
        <p>
          If you believe content on Carza infringes your copyright, send a notice to our copyright
          agent as described on our <Link href="/copyright">Copyright</Link> page. We remove
          infringing content, tell the person who posted it, accept counter-notices, and suspend or
          close the accounts of repeat infringers.
        </p>
        <p>
          If an intimate image of you was shared without your consent, use{' '}
          <Link href="/takedown">Remove an intimate image</Link>. We remove it within 48 hours of a
          valid request. You don’t need an account.
        </p>
      </LegalSection>

      <LegalSection title="8. Ending your use">
        <p>
          You can stop using Carza at any time. We may suspend or end your access if you break these
          terms or if we stop offering Carza. Sections that by their nature should continue (such as
          ownership, disclaimers and limits on liability) survive.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimers">
        <p>
          Carza is provided “as is” and “as available”. To the fullest extent the law allows, we
          make no warranties, express or implied, including about accuracy, availability, fitness
          for a particular purpose, or the content and conduct of other users, including at events.
        </p>
      </LegalSection>

      <LegalSection title="10. Limit of liability">
        <p>
          To the fullest extent the law allows, Carza is not liable for indirect, incidental,
          special, consequential or punitive damages, or for lost profits, data or goodwill. Our
          total liability for any claim about Carza is limited to US$100. Some places do not allow
          these limits, so they may not apply to you.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update these terms. If a change is significant, we will tell you in the app or by
          email before it takes effect. Using Carza after that means you accept the new terms.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing law">
        <p>
          These terms are governed by the laws of the United States and the state where Carza is
          organized, without regard to conflict-of-law rules.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Questions about these terms, or a legal request: see <Link href="/contact">Contact</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

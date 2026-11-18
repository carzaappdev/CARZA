import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL } from '@/components/legal/legal';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Get help with Carza: your account, reporting content, and contacting us.',
};

const link = 'font-semibold underline underline-offset-4';

/** Public help page, also the App Store "Support URL". */
export default function SupportPage() {
  return (
    <LegalPage
      title="Support"
      current="/support"
      intro="Need a hand with Carza? Most things can be done right in the app. For anything else, email us and a real person will get back to you, usually within a day."
    >
      <LegalSection title="Contact us">
        <p>
          Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
            {CONTACT_EMAIL}
          </a>{' '}
          with your username and what happened. Screenshots help.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul>
          <li>
            <strong>Forgot your password:</strong> tap “Forgot password?” on the{' '}
            <Link href="/sign-in" className={link}>
              sign-in page
            </Link>{' '}
            and we’ll email you a link.
          </li>
          <li>
            <strong>Edit your profile, alerts or location:</strong> open your profile menu and
            choose Settings.
          </li>
          <li>
            <strong>Delete your account:</strong> go to Settings, then Delete account. This removes
            your profile, posts, reels, garage and events for good.
          </li>
          <li>
            <strong>Download your data:</strong> Settings, then Your data.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Safety">
        <ul>
          <li>
            <strong>Report a post, reel, comment, event or person:</strong> tap the ••• menu on it
            and choose Report. We review every report.
          </li>
          <li>
            <strong>Block someone:</strong> tap ••• on their profile or content and choose Block.
            Neither of you will see the other. Manage blocked people in Settings.
          </li>
          <li>If someone is in danger, call your local emergency number first, then tell us.</li>
        </ul>
        <p>
          Read our{' '}
          <Link href="/guidelines" className={link}>
            Community Guidelines
          </Link>
          ,{' '}
          <Link href="/terms" className={link}>
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className={link}>
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}

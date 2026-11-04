import type { Metadata } from 'next';
import { CONTACT_EMAIL } from '@/components/legal/legal';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';

function Contact() {
  return CONTACT_EMAIL ? (
    <>
      email{' '}
      <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline underline-offset-4">
        {CONTACT_EMAIL}
      </a>{' '}
      and we will answer within 30 days.
    </>
  ) : (
    <>use Report in the app and choose “Other”, and we will answer within 30 days.</>
  );
}

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Carza collects, why, and the choices you have.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      current="/privacy"
      intro="Carza is a social app, so much of what you share is public by design. This policy explains what we collect, why, who we share it with, and the choices you have. We do not sell your personal information and we do not show ads."
    >
      <LegalSection title="What you give us">
        <ul>
          <li>
            <strong>Account details:</strong> email address and password (stored only as a secure
            hash), or the name and email Google or Apple share with us if you sign in with them.
          </li>
          <li>
            <strong>Profile:</strong> display name, username, bio, photo, and the cars in your
            garage.
          </li>
          <li>
            <strong>Content:</strong> posts, photos, reels, comments, likes, follows, events and
            RSVPs.
          </li>
          <li>
            <strong>Location you choose:</strong> a home ZIP code and event addresses. We do not
            track your device’s location.
          </li>
          <li>
            <strong>Reports and blocks</strong> you make, including a copy of the reported content.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What we collect automatically">
        <ul>
          <li>
            Basic technical logs from our hosting providers, such as IP address, browser type and
            pages requested, used for security and fixing problems.
          </li>
          <li>Reel view counts, so creators see how many people watched.</li>
          <li>
            Cookies and local storage that keep you signed in, remember your ZIP code and theme, and
            count reel views without an account. We do not use advertising or cross-site tracking
            cookies.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What is public">
        <p>
          Your profile, posts, reels, events, comments, follows and garage are visible to anyone,
          including people without an account, and may appear in link previews. Event addresses are
          shown to everyone who can see the event. Who you block is private. Think before you share
          where you live or park.
        </p>
      </LegalSection>

      <LegalSection title="How we use it">
        <ul>
          <li>To run Carza: show your content, build your feed, and send notifications.</li>
          <li>To show nearby events and people, using the ZIP code you gave us.</li>
          <li>To keep people safe: prevent spam and abuse, and review reports.</li>
          <li>To send account emails such as sign-in links and password resets.</li>
          <li>To meet legal obligations.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>We share personal information only with:</p>
        <ul>
          <li>
            Service providers that run Carza for us: Supabase (database, sign-in and file storage),
            Vercel (hosting) and Resend (email). They may only use it to provide their service to
            us.
          </li>
          <li>Google or Apple, if you choose to sign in with them.</li>
          <li>Authorities, when the law requires it or when needed to protect someone’s safety.</li>
          <li>A buyer or successor, if Carza is ever sold or merged, under this policy.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep your information while your account is open. Content you delete is removed from
          Carza right away and from backups over time. Read notifications are deleted after 90 days.
          Reports may be kept longer to deal with repeat abuse.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <ul>
          <li>Edit your profile and delete your posts, reels, comments and events at any time.</li>
          <li>Block people so neither of you sees the other.</li>
          <li>
            Download a copy of your data, or delete your account and everything in it, from Settings
            at any time.
          </li>
          <li>
            For any other privacy request, <Contact />
          </li>
        </ul>
        <p>
          Depending on where you live (for example California), you may have more rights under local
          law. We will not treat you differently for using them.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Carza is not for children under 13, and we do not knowingly collect their information. If
          you think a child under 13 has an account, report the profile and we will remove it.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We protect your information with encryption in transit, access rules on every database
          table, and rate limits against abuse. No service is perfectly secure, so use a strong,
          unique password.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If we change this policy in a significant way, we will tell you in the app or by email
          before the change takes effect.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

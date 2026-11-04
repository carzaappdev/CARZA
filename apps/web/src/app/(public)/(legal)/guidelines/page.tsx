import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Community Guidelines',
  description: 'How to be a good member of the Carza community.',
};

export default function GuidelinesPage() {
  return (
    <LegalPage
      title="Community Guidelines"
      current="/guidelines"
      intro="Carza is for people who love cars to share their builds, find meets, and help each other out. These guidelines keep it friendly and safe. Break them and we may remove your content or your account."
    >
      <LegalSection title="Be a good neighbor">
        <ul>
          <li>Respect people, even when you disagree about their build.</li>
          <li>No harassment, bullying, threats, or hate based on who someone is.</li>
          <li>Don’t pretend to be someone else, or a business you don’t represent.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Keep it safe and legal">
        <ul>
          <li>
            No street racing, takeovers, sideshows, or reckless driving on public roads, and no
            content that promotes them.
          </li>
          <li>No drinking and driving, and no events that encourage it.</li>
          <li>No stolen cars or parts, or help taking them.</li>
          <li>No weapons, drugs, or anything else illegal.</li>
          <li>Track days and closed-course events are welcome.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Host great events">
        <ul>
          <li>Only host at places where you have permission to gather.</li>
          <li>Give an accurate time, place and description, and cancel if plans change.</li>
          <li>Leave the spot cleaner than you found it.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Share what’s yours">
        <ul>
          <li>Post photos and videos you took or have the right to share.</li>
          <li>Blur or crop license plates and faces if people didn’t agree to be in your shot.</li>
          <li>Never post someone’s home address or other private information.</li>
        </ul>
      </LegalSection>

      <LegalSection title="No spam or scams">
        <ul>
          <li>No fake engagement, repeated posts, or misleading links.</li>
          <li>No scams, fake giveaways, or asking people for money or passwords.</li>
          <li>No nudity or sexual content.</li>
        </ul>
      </LegalSection>

      <LegalSection title="See something? Report it">
        <p>
          Use Report on any post, reel, event or profile. Reports are private, and our team reviews
          them. You can also block anyone so neither of you sees the other. If someone is in danger,
          call 911 first.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

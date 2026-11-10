# Legal launch checklist

What Carza needs in place to launch in the US as a 13+ social app, what the code already does, and what
only the owner can do. This is an engineering checklist based on research in November 2026, not legal
advice. Have a lawyer review the items marked **Lawyer**.

## Owner tasks before launch

| #   | Task                                                                           | Why                                                                                                                                                     | How                                                                                       |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Pick the public contact email and set `NEXT_PUBLIC_CONTACT_EMAIL` in Vercel    | People without an account must be able to reach you. Requests can carry a 48-hour deadline.                                                             | The mailbox must exist and be checked daily. Redeploy after setting it.                   |
| 2   | Set `NEXT_PUBLIC_LEGAL_NAME` and `NEXT_PUBLIC_LEGAL_ADDRESS` in Vercel         | The copyright agent's name and address must appear on the site.                                                                                         | Use the company's legal name and a postal address you're happy to publish.                |
| 3   | Register a DMCA designated agent                                               | Without it there is no copyright safe harbor for what users upload (reels with music are the main risk).                                                | https://dmca.copyright.gov, $6, renew every 3 years. The details must match `/copyright`. |
| 4   | Register with NCMEC as an electronic service provider                          | Federal law requires reporting apparent child sexual abuse material once you know of it. You need CyberTipline access before the first case, not after. | Start at https://www.missingkids.org (CyberTipline, ESP registration).                    |
| 5   | Decide who checks the admin queue every day, including weekends                | Intimate-image removal requests must be handled within 48 hours of arriving.                                                                            | `/account/reports`. Urgent items are at the top with a countdown.                         |
| 6   | **Lawyer:** review Terms, Privacy, Guidelines, Copyright and the takedown page | They were drafted by engineers. Limits of liability, the events disclaimer and terms for under-18s need a professional read.                            | Pages live under `apps/web/src/app/(public)/(legal)/`.                                    |
| 7   | **Lawyer:** confirm the Texas SCOPE Act small-business exemption applies       | It most likely does (SBA small business), which is why no parental-consent tooling was built.                                                           | Tex. Bus. & Com. Code §509.002(b)(4).                                                     |
| 8   | Turn on leaked-password protection in Supabase                                 | Security hygiene the privacy policy relies on.                                                                                                          | Supabase → Authentication → password settings.                                            |

## What the app does

| Requirement                                                                                                   | Where                                                         |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 13+ with a neutral age screen; under-13 accounts refused or deleted with their files                          | Sign-up form, `/age`, `20261109000000_age_and_teen_rules.sql` |
| Teens (13–17): no messages with adults, can't host, don't see 18+ events, no night-time push                  | Same migration                                                |
| Intimate-image removal: public form, no account needed, ticket number, 48-hour countdown for admins           | `/takedown`, `legal_requests`, `/account/reports`             |
| Copyright: agent details, notice and counter-notice forms, repeat-infringer record                            | `/copyright`, `moderation_actions`                            |
| Child safety: report reason, escalation that suspends the account and preserves everything out of public view | `/account/reports`, `evidence` bucket                         |
| Report and block on posts, reels, events, messages and profiles; suspension; removal log                      | `/account/reports`                                            |
| Privacy policy with what's collected, who it's shared with, retention, Do Not Track, children                 | `/privacy`                                                    |
| Download your data, delete your account in the app                                                            | Settings                                                      |
| Hosts confirm permission and no street racing when publishing an event                                        | Event form                                                    |
| Terms accepted at sign-up, with the time recorded                                                             | `profile_private.terms_accepted_at`                           |

## Before going national

These don't bind the Austin launch but will matter when people in other states sign up. Each needs a
decision, and probably a lawyer.

- **Mississippi, Tennessee, Georgia:** laws in force that expect "commercially reasonable" age
  verification of all account holders and parental consent for minors. A typed date of birth likely
  isn't enough. Options: a third-party age check, or not offering sign-up in those states.
- **California (from January 2027) and New York (from late January 2027):** limits on personalized
  feeds and night-time notifications for minors. Carza's "For you" feed is the trigger. The simplest
  answer is a newest-first feed for under-18s.
- **Florida, Ohio, Virginia, Nebraska, Utah, Louisiana, Arkansas:** in court or with thresholds Carza
  doesn't meet today. Re-check before expanding.
- **App stores:** listing in the App Store or Google Play brings their own rules (and state app-store
  laws in Texas and elsewhere). The report, block and account-deletion features they require are built.

## Things to keep true

- Never sell or share personal data for advertising. The privacy policy says we don't.
- Keep ZIP-level location only. No GPS, no exact addresses for people's homes.
- No sexual content. It stays banned in the guidelines.
- If you add analytics, ads, payments, SMS or face recognition, the privacy policy and this checklist
  need updating first.
- A data breach affecting Texans must be reported to them (and to the Texas Attorney General if 250 or
  more are affected). Check the current deadline at the time.

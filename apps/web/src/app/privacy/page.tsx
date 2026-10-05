import { StaticPage } from '@/components/layout/StaticPage';

export const metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy" lede="What we keep about you, why, and what we do not do." draft>
      <section><h2>What we store</h2><ul><li>Your username, email address and a hashed password (we cannot read your password).</li><li>What you post, comment, vote on and save.</li><li>Images you upload, with location and camera data removed.</li><li>A short-lived record of sign-in attempts, to stop abuse.</li></ul></section>
      <section><h2>What we use it for</h2><p>To run the site: sign you in, show your content, send verification and password-reset emails, and enforce the rules. Your email is not shown to anyone.</p></section>
      <section><h2>What we do not do</h2><ul><li>We do not sell your data.</li><li>We do not run third-party advertising trackers. Some spaces may vote to show ads; if so, that is said on the space.</li><li>We do not load fonts or scripts from other companies.</li></ul></section>
      <section><h2>What is public</h2><p>Your username, posts, comments, alignment and the spaces you moderate are public. Moderation actions, including who took them and why, are public by design.</p></section>
      <section><h2>Your data, your choice</h2><ul><li><b>Download it.</b> Settings has a button that gives you everything we hold about you as one file.</li><li><b>Delete your account.</b> Also in Settings. Your email, password, bio and picture are erased and every device is signed out. Your username is retired, and anything you leave behind shows as &quot;[deleted]&quot;.</li><li><b>Erase what you wrote.</b> When you delete, you can tick a box to blank your posts and comments and delete your uploaded images too.</li><li><b>What stays.</b> Moderation decisions that involved you remain in the public log, and your past votes in elections stay counted, both under an anonymous name. We keep these because the community needs to be able to check them.</li></ul><p>If you are the only moderator of a space with other members, or a site admin, hand that over first so the community is never left without one. Backups can take a little time to roll over.</p></section>
      <section><h2>Legal requests</h2><p>If we are legally required to hand over data we will publish that we received the request. The warrant canary on the transparency page tells you when we have not received any.</p></section>
    </StaticPage>
  );
}

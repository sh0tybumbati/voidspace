import Link from 'next/link';
import { StaticPage } from '@/components/layout/StaticPage';

export const metadata = { title: 'How Voidspace works' };

export default function AboutPage() {
  return (
    <StaticPage title="How Voidspace works" lede="Voidspace is a community site where the people in a space decide who runs it, and every moderation decision is on the record.">
      <section><h2>Spaces</h2><p>A space (written v/name) is a community. Whoever creates it is its founder and first moderator. Anyone can post, comment and vote, within the space&apos;s rules.</p></section>
      <section><h2>Elected moderators</h2><p>Moderators are not appointed for life. Members can nominate someone, discuss, then vote.</p>
        <ul><li>The candidate must have an account at least 30 days old and 100 alignment in the space, and must accept the nomination.</li><li>3 days of nomination and discussion, then 7 days of voting.</li><li>It passes with 60% approval and 10% of members voting. Removing a founder needs 75%.</li><li>Results stay hidden until voting closes, so the early count cannot sway anyone.</li><li>A space always keeps at least one moderator.</li></ul></section>
      <section><h2>Community votes</h2><p>Members can also vote on big decisions: changing the rules, turning ads on or off, making the space private or public, or deleting it. These need 15% turnout and 60% approval.</p></section>
      <section><h2>Public moderation, with appeals</h2><ul><li>Every removal and ban is in the space&apos;s <em>mod log</em> with the moderator&apos;s name and reason.</li><li>If something of yours is removed you are told why, and can appeal for 30 days.</li><li>A different moderator reviews it. If there is none, or you think the first acted in bad faith, it goes to the site admins.</li><li>An approved appeal reverses the action. Reversed actions stay in the log.</li></ul></section>
      <section><h2>Alignment</h2><p>Alignment is a score earned in each space from how its members vote on your posts and comments. It is how a space knows who has been a good part of it.</p></section>
      <section><h2>The site admins</h2><p>Admins can act across the whole site, but each action needs a written justification, and it is published on the <Link href="/transparency" className="link">transparency page</Link> along with legal requests we receive and a warrant canary.</p></section>
      <section><h2>Reporting</h2><p>Use Report on a post, comment or person. Space rules go to that space&apos;s moderators. Accounts and anything illegal go to the admins.</p></section>
    </StaticPage>
  );
}

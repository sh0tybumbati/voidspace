import Link from 'next/link';
import { StaticPage } from '@/components/layout/StaticPage';

export const metadata = { title: 'Terms of use' };

export default function TermsPage() {
  return (
    <StaticPage title="Terms of use" lede="The short version: be decent, do not break the law, and you keep ownership of what you write." draft>
      <section><h2>Your account</h2><p>You are responsible for what happens under your account. Keep your password safe. You must be old enough to use the site where you live, and 18 or older to open adult spaces.</p></section>
      <section><h2>Your content</h2><p>You own what you post. By posting you give Voidspace permission to store it and show it to others as the site works. You can delete your posts and comments at any time.</p></section>
      <section><h2>What is not allowed</h2><ul><li>Anything illegal, including content that exploits or endangers children.</li><li>Harassment, threats, or sharing someone&apos;s private information.</li><li>Spam, scams, malware, or trying to break or overload the site.</li><li>Pretending to be someone else.</li></ul></section>
      <section><h2>How rules are enforced</h2><p>Each space has its own rules, enforced by its elected moderators. Site-wide rules are enforced by the admins. Decisions are logged in public and can be appealed, as described in <Link href="/about" className="link">how it works</Link>.</p></section>
      <section><h2>Legal requests</h2><p>When we receive a takedown request or legal order we publish it, and what we did, on the <Link href="/transparency" className="link">transparency page</Link>, unless the law forbids it.</p></section>
      <section><h2>No guarantees</h2><p>The site is provided as it is. It may go down or change. We are not liable for what users post.</p></section>
      <section><h2>Changes</h2><p>If these terms change in a way that matters, we will say so on the site before it takes effect.</p></section>
    </StaticPage>
  );
}

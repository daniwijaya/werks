import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

const content: Record<string, { title: string; body: string }> = {
  sources: {
    title: "Data sources",
    body: "No external job sources are connected in this preview. Listings are fictional demonstrations and link only to example.com. Source attribution and outbound links will be shown for any future permitted listings.",
  },
};

function AboutPage() {
  return (
    <article className="about-page wrap">
      <div className="about-content">
        <header className="about-intro">
          <p className="eyebrow">WERKS · OUR STORY</p>
          <div className="about-intro-title-row">
            <h1>About <span className="about-brand">WERKS</span></h1>
            <Image className="about-intro-logo" src="/images/werk-logo-cat.png" alt="WERKS" width={2172} height={724} />
          </div>
          <p className="about-deck">Built by a designer, for designers.</p>
        </header>

        <section className="about-section">
          <p>WERKS started with a concern that has become increasingly difficult to ignore: finding a job as a designer is getting harder.</p>
          <p>Across Indonesia&apos;s design industry, many talented designers have faced layoffs, lost their jobs, or found themselves struggling to discover their next opportunity. Behind every job listing is a person with skills, ambitions, responsibilities, and a passion for creating meaningful work.</p>
          <p>As a designer myself, I understand how frustrating the job search can be. Opportunities are scattered across different job portals, company career pages, and professional networks. Finding the right role often means jumping between platforms, repeating searches, and spending hours looking for opportunities that may already be out of reach.</p>
          <p>I started wondering: <strong>What if designers could discover job opportunities from different sources in one place?</strong></p>
          <p>That&apos;s where WERKS comes in.</p>
        </section>

        <section className="about-section">
          <h2>One place. More opportunities.</h2>
          <p>WERKS is an independent job discovery platform built to help designers find opportunities without the hassle of searching across multiple platforms.</p>
          <p>By bringing design job listings from different sources into one place, WERKS aims to make job discovery simpler, more accessible, and less exhausting.</p>
          <p>Whether you&apos;re a Product Designer, UI/UX Designer, Graphic Designer, Motion Designer, or working in another creative discipline, WERKS is here to help you discover opportunities that could lead to your next chapter.</p>
          <p>We&apos;re not here to replace job portals or promise that finding a job will be easy. We&apos;re here to make discovering opportunities a little easier.</p>
        </section>

        <section className="about-section">
          <h2>A personal project with a bigger purpose.</h2>
          <p>WERKS is my way of contributing to the design community, starting with a practical problem many of us have experienced firsthand.</p>
          <p>This platform is a work in progress, and there&apos;s still a long way to go. But I hope it can become a useful resource for designers navigating an increasingly challenging job market in Indonesia.</p>
          <p>Because behind every designer is a story, a journey, and something worth creating next.</p>
        </section>

        <footer className="about-signoff">
          <h2>Don&apos;t Stop <span>Designing.</span></h2>
          <p>Your next opportunity might be closer than you think.</p>
        </footer>
      </div>
    </article>
  );
}

function PrivacyPage() {
  return (
    <article className="privacy-page wrap">
      <div className="privacy-content">
        <header className="privacy-intro">
          <p className="eyebrow">WERKS · THE DETAILS</p>
          <h1>Privacy <span className="accent-dot">Policy.</span></h1>
          <p className="privacy-updated">Last updated: November 2, 2026</p>
          <p className="privacy-lead">At WERKS, your privacy matters. This policy explains how we handle information when you use our platform to discover design job opportunities.</p>
        </header>

        <div className="privacy-accordions">
          <details>
            <summary>1. Information We Collect</summary>
            <div className="privacy-detail-body">
              <p>WERKS may process search queries, feedback you submit, and technical information such as browser details and server logs, depending on how the website is configured.</p>
              <p>If you use Saved Jobs, your selections may be stored locally in your browser. You don&apos;t need an account to browse job listings.</p>
            </div>
          </details>
          <details>
            <summary>2. How We Use Information</summary>
            <div className="privacy-detail-body">
              <p>We use information as necessary to:</p>
              <ul><li>Provide and improve job discovery features.</li><li>Remember saved jobs on your device.</li><li>Respond to feedback and job reports.</li><li>Maintain website security and performance.</li></ul>
            </div>
          </details>
          <details>
            <summary>3. Third-Party Links</summary>
            <div className="privacy-detail-body"><p>WERKS aggregates job information from external sources. When you visit an original job listing or apply through another website, that website&apos;s privacy policy and practices apply. WERKS does not control how external websites handle your information.</p></div>
          </details>
          <details>
            <summary>4. Cookies and Storage</summary>
            <div className="privacy-detail-body"><p>WERKS may use local storage for features such as Saved Jobs. Cookies or analytics technologies may also be used if enabled. We aim to minimize unnecessary tracking and provide consent controls where required by law.</p></div>
          </details>
          <details>
            <summary>5. Data Sharing and Security</summary>
            <div className="privacy-detail-body">
              <p>Information may be processed by service providers that help operate and secure WERKS, or disclosed when required by law. We take reasonable measures to protect information but cannot guarantee absolute security.</p>
              <p>We do not intend to sell your personal information.</p>
            </div>
          </details>
          <details>
            <summary>6. Your Rights</summary>
            <div className="privacy-detail-body"><p>Depending on applicable law, you may have the right to access, correct, or request deletion of your personal information, or withdraw consent where applicable.</p><p>To submit a privacy-related request, contact us using the details below.</p></div>
          </details>
          <details>
            <summary>7. Policy Updates</summary>
            <div className="privacy-detail-body"><p>We may update this policy as WERKS evolves. Any changes will be reflected on this page with an updated revision date.</p></div>
          </details>
          <details>
            <summary>8. Contact Us</summary>
            <div className="privacy-detail-body">
              <p>For questions about this Privacy Policy, contact:</p>
              <address><strong>Dani Wijaya</strong><br />Creator of WERKS<br />Email: <a href="mailto:danyswijaya@gmail.com">danyswijaya@gmail.com</a><br />Website: <a href="https://www.daniwijaya.com/" target="_blank" rel="noreferrer">www.daniwijaya.com</a></address>
            </div>
          </details>
        </div>
        <footer className="privacy-signoff"><strong>WERKS — Don&apos;t Stop Designing.</strong></footer>
      </div>
    </article>
  );
}

export default async function InfoPage({ params }: { params: Promise<{ info: string }> }) {
  const { info } = await params;
  if (info === "about") return <AboutPage />;
  if (info === "privacy") return <PrivacyPage />;

  const page = content[info];
  if (!page) {
    return <section className="empty-state wrap"><h1>Page not found</h1><Link href="/">Back home</Link></section>;
  }

  return (
    <section className="info-page wrap">
      <p className="eyebrow">WERKS · THE DETAILS</p>
      <h1>{page.title}<span className="accent-dot">.</span></h1>
      <p>{page.body}</p>
      <Link href="/" className="text-link">Back home <ArrowUpRight size={14} aria-hidden="true" /></Link>
    </section>
  );
}

import Image from "next/image";
import { Landmark } from "lucide-react";

const waysSupportHelps = [
  {
    number: "01",
    title: "Keep WERKS running",
    body: "Help cover the time and tools it takes to maintain the platform.",
  },
  {
    number: "02",
    title: "Make discovery better",
    body: "Support improvements that make finding design opportunities easier.",
  },
  {
    number: "03",
    title: "Help an independent creator",
    body: "Give me more room to build WERKS into a useful home for Indonesia’s design community.",
  },
];

export default function DonatePage() {
  return (
    <section className="donate-page wrap">
      <p className="eyebrow"><span className="eyebrow-line" /> A NOTE FROM THE CREATOR</p>
      <div className="donate-intro">
        <div>
          <h1>Help WERKS keep<br /><em>creating.</em></h1>
          <p className="donate-lead">
            I built WERKS to make it easier for designers in Indonesia to find their next opportunity.
            If this project has been useful to you, a donation helps me keep building it independently.
          </p>
        </div>
        <div className="donate-hero-art" aria-hidden="true">
          <Image src="/images/donate-hero-illustration.png" alt="" fill priority sizes="(max-width: 700px) 90vw, 72vw" />
        </div>
      </div>

      <div className="donate-support-grid">
        {waysSupportHelps.map(item => (
          <article className="donate-support-card" key={item.number}>
            <span>{item.number}</span>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </article>
        ))}
      </div>

      <div className="donate-panel donate-coming-soon">
        <div className="donate-panel-icon"><Landmark size={17} /></div>
        <div>
          <h2>Donations are in progress</h2>
          <p>The donation feature is being prepared. Please check back soon.</p>
        </div>
      </div>
    </section>
  );
}

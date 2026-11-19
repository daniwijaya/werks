import Image from "next/image";
import { DonateContribution } from "@/components/donate-contribution";

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

      <DonateContribution />

    </section>
  );
}

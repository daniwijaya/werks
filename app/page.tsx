import { BriefcaseBusiness, Clock3, LayoutGrid, MapPin, Search } from "lucide-react";
import Image from "next/image";
import { Suspense } from "react";
import { DropdownSelect } from "@/components/dropdown-select";
import { LiveHomeJobFeed } from "@/components/live-home-job-feed";
import { indonesiaCities } from "@/data/indonesia-cities";
import { JobFeedState } from "@/components/job-feed-state";

export const dynamic = "force-dynamic";

const categories = ["All", "Product Design", "UI/UX Design", "UX Research", "Graphic Design", "Motion Design", "Illustration", "Others"];

export default function Home() {
  return <>
    <section className="home-hero wrap">
      <div className="hero-art" aria-hidden="true">
        <Image src="/images/werk-hero-illustration.png" alt="" fill priority sizes="(max-width: 700px) 90vw, 56vw" />
      </div>
      <div className="hero-copy">
        <h1>Find <em>design</em> jobs<br />across Indonesia.</h1>
        <p className="hero-sub">Discover the latest opportunities in product, UI/UX,<br className="desktop-break" /> graphic, and more — all in one place.</p>
      </div>
      <form className="search-panel" action="/jobs">
        <label className="keyword-field">
          <Search size={20} />
          <input aria-label="Job title, company, or keyword" name="q" placeholder="Search for job title, company, or keyword..." />
        </label>
        <div className="select-field">
          <LayoutGrid size={19} />
          <DropdownSelect name="discipline" label="Job Function" options={[{ label: "Job Function", value: "" }, ...categories.slice(1).map(category => ({ label: category, value: category }))]} />
        </div>
        <div className="select-field">
          <MapPin size={20} />
          <DropdownSelect searchable name="location" label="Location" options={[{ label: "Location", value: "" }, ...indonesiaCities.map(city => ({ label: city, value: city }))]} />
        </div>
        <div className="select-field">
          <BriefcaseBusiness size={19} />
          <DropdownSelect name="mode" label="Work Setting" options={[{ label: "Work Setting", value: "" }, ...["Remote", "Hybrid", "On-site"].map(mode => ({ label: mode, value: mode }))]} />
        </div>
        <div className="select-field mobile-search-field">
          <Clock3 size={19} />
          <DropdownSelect name="type" label="Job Type" options={[{ label: "Job Type", value: "" }, ...["Full-time", "Part-time", "Contract", "Freelance"].map(type => ({ label: type, value: type }))]} />
        </div>
        <button className="button-primary" type="submit">Search</button>
      </form>
    </section>
    <Suspense fallback={<JobFeedState state="loading" />}>
      <LiveHomeJobFeed />
    </Suspense>
  </>;
}

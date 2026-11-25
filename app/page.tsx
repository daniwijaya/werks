import Image from "next/image";
import { CommunityExperience } from "@/components/community-experience";
import { communityPostFixtures } from "@/data/community-post-fixtures";
import { getHomepageCommunityPosts } from "@/lib/community-feed";

export const dynamic = "force-dynamic";

export default function Home() {
  const { posts, developmentPreview } = getHomepageCommunityPosts(process.env.NODE_ENV, communityPostFixtures);

  return <>
    <section className="home-hero wrap community-hero">
      <div className="hero-art" aria-hidden="true">
        <Image src="/images/werk-hero-illustration.png" alt="" fill priority sizes="(max-width: 700px) 90vw, 56vw" />
      </div>
      <div className="hero-copy">
        <h1>Good opportunities<br />are meant to be <em>shared.</em></h1>
        <p className="hero-sub">Discover and share job opportunities with Indonesia&apos;s creative community.</p>
      </div>
    </section>
    <CommunityExperience posts={posts} developmentPreview={developmentPreview} />
  </>;
}

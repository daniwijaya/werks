import Link from "next/link";
export default function NotFound(){ return <section className="empty-state wrap not-found"><span>404</span><h1>That listing took another path.</h1><p>It may have expired or moved.</p><Link href="/jobs" className="button-secondary">Browse all jobs</Link></section>; }

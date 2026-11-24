export default function JobsLoading() {
  return (
    <section className="listing-page wrap" aria-live="polite" aria-busy="true">
      <div className="page-heading">
        <p className="eyebrow">THE GOOD STUFF, IN ONE PLACE</p>
        <h1>Don&apos;t Stop<br /><span>Designing.</span></h1>
        <p className="section-sub">Loading current job opportunities…</p>
      </div>
      <div className="job-feed-loading" aria-hidden="true"><span /><span /><span /></div>
    </section>
  );
}

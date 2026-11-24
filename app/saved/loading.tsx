export default function SavedLoading() {
  return (
    <section className="listing-page wrap" aria-live="polite" aria-busy="true">
      <div className="page-heading">
        <p className="eyebrow">YOUR PERSONAL SHORTLIST</p>
        <h1>Saved jobs<span className="accent-dot">.</span></h1>
        <p className="section-sub">Loading your current saved listings…</p>
      </div>
      <div className="job-feed-loading" aria-hidden="true"><span /><span /><span /></div>
    </section>
  );
}

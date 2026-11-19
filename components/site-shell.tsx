"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, Heart, House, Info, Menu, X } from "lucide-react";
export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  return <header className="site-header wrap"><Link className="wordmark" href="/" aria-label="WERKS home"><Image className="wordmark-image" src="/images/werk-logo-cat.png" alt="WERKS" width={2172} height={724} priority/></Link><nav className="header-nav"><div id="site-navigation" className={`header-links${menuOpen ? " is-open" : ""}`}><Link className="saved-nav" href="/saved" aria-current={pathname === "/saved" ? "page" : undefined}><Bookmark size={17}/> Saved Jobs</Link><Link href="/about" aria-current={pathname === "/about" ? "page" : undefined}>About</Link><Link className="sources-nav" href="/sources" aria-current={pathname === "/sources" ? "page" : undefined}>Data Sources</Link></div><Link className="donate-nav" href="/donate" aria-current={pathname === "/donate" ? "page" : undefined}><Heart size={14}/> Donate</Link><button className="menu-toggle" type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button></nav></header>;
}
export function Footer() { const pathname = usePathname(); return <footer className={`footer wrap${pathname === "/" ? " footer-homepage" : ""}`}><div><Link className="wordmark" href="/" aria-label="WERKS home"><Image className="wordmark-image" src="/images/werk-logo-cat.png" alt="WERKS" width={2172} height={724}/></Link></div><div className="footer-links"><Link href="/about">About</Link><Link href="/sources">Data sources</Link><Link href="/privacy">Privacy</Link></div><small>© 2026 WERKS Indonesia</small></footer>; }
export function BottomNavigation() {
  const pathname = usePathname();
  return <nav className="mobile-bottom-nav" aria-label="Quick navigation">
    <Link href="/" aria-current={pathname === "/" ? "page" : undefined}><House size={18}/><span>Home</span></Link>
    <Link href="/saved" aria-current={pathname === "/saved" ? "page" : undefined}><Bookmark size={18}/><span>Saved Jobs</span></Link>
    <Link href="/about" aria-current={pathname === "/about" ? "page" : undefined}><Info size={18}/><span>About</span></Link>
  </nav>;
}

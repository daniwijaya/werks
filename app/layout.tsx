import type { Metadata } from "next";
import "./globals.css";
import { Header, Footer, BottomNavigation } from "@/components/site-shell";
export const metadata: Metadata = { title: "WERKS — Find your next creative opportunity", description: "Discover design jobs from multiple sources, all in one place." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Header/><main>{children}</main><Footer/><BottomNavigation/></body></html>; }

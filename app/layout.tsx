import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"MAZZARI No. 1 / Mazzagotte Instrument Company",description:"An electromechanical-inspired information board by Mazzagotte Instrument Company. Precision in every flip."};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}

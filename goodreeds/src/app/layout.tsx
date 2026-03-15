import type { Metadata } from "next";
import { Libre_Baskerville, Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const baskerville = Libre_Baskerville({
  variable: "--font-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Good Reeds \u2014 Meet Your Next Favorite Reed \uD83C\uDF3E",
  description:
    'The world\'s largest community for reed lovers. Find and share the reeds you love. "Man is but a reed, the most feeble thing in nature; but he is a thinking reed." \u2014 Blaise Pascal',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} ${baskerville.variable} antialiased`}
        style={{ fontFamily: "var(--font-montserrat), Arial, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}

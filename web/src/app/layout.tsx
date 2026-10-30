import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  adjustFontFallback: false,
  fallback: ["Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "formER – Government form helper and service navigator (demo)",
  description:
    "Upload a Government of Canada form, click any field for a plain-language explanation, and find official Canada.ca resources. Unofficial hackathon prototype.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" suppressHydrationWarning className={`${atkinson.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

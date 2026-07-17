import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MyAI OS Console",
    template: "%s — MyAI OS"
  },
  description: "MyAI OS adalah AI Gateway terpusat untuk ekosistem Bali Enterprises Group (termasuk afiliasi seperti Indonesian Visas, Tropic Tech, Wellness Bali, dan Bali Help), menyatukan integrasi kecerdasan buatan untuk seluruh produk grup. Dipersiapkan menjadi pelopor infrastruktur AI lokal Indonesia.",
  openGraph: {
    title: "MyAI OS Console",
    description: "MyAI OS adalah AI Gateway terpusat untuk ekosistem Bali Enterprises Group, menyatukan integrasi kecerdasan buatan untuk seluruh produk grup. Dipersiapkan menjadi pelopor infrastruktur AI lokal Indonesia.",
    url: "https://myai.bali.technology",
    siteName: "MyAI OS",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyAI OS Console",
    description: "AI Gateway terpusat untuk ekosistem Bali Enterprises Group.",
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://console.myai.bali.technology"),
  title: {
    default: "MyAI OS Console",
    template: "%s — MyAI OS"
  },
  description: "MyAI OS adalah AI Gateway terpusat untuk ekosistem Bali Enterprises Group, dikembangkan oleh Bali Technology (divisi riset PT Indonesian Visas Agency) dengan IndoDesign.website sebagai kontributor antarmuka (UI/design). Menyinergikan integrasi kecerdasan buatan terpadu untuk pelopor infrastruktur AI lokal Indonesia.",
  openGraph: {
    title: "MyAI OS Console",
    description: "MyAI OS adalah AI Gateway terpusat untuk ekosistem Bali Enterprises Group, dikembangkan oleh Bali Technology (divisi riset PT Indonesian Visas Agency) dengan IndoDesign.website sebagai kontributor antarmuka.",
    url: "https://console.myai.bali.technology",
    siteName: "MyAI OS",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/og-image.webp",
        width: 1200,
        height: 630,
        alt: "MyAI OS Console Banner",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MyAI OS Console",
    description: "AI Gateway terpusat untuk ekosistem Bali Enterprises Group, oleh Bali Technology.",
    images: ["/og-image.webp"],
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

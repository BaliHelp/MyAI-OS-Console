import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://console.myai.bali.technology"),
  title: {
    default: "MyAI OS Console",
    template: "%s — MyAI OS"
  },
  description: "MyAI OS adalah AI Gateway terpusat untuk ekosistem Bali Enterprises Group, dikembangkan oleh Bali Technology (divisi riset PT Indonesian Visas Agency) dengan IndoDesign.website sebagai kontributor antarmuka (UI/design). Menyinergikan integrasi kecerdasan buatan terpadu untuk pelopor infrastruktur AI lokal Indonesia.",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true
    }
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://myai.bali.technology/#organization",
                  "name": "MyAI OS",
                  "legalName": "MyAI OS - a Bali Technology product",
                  "url": "https://console.myai.bali.technology",
                  "description": "MyAI OS adalah AI Gateway terpusat yang menyatukan seluruh integrasi kecerdasan buatan untuk ekosistem Bali Enterprises Group — dipersiapkan menjadi pelopor infrastruktur AI lokal Indonesia, mendukung Indonesian Visas, MyBusiness, Tropic Tech, dan divisi lainnya di bawah satu kendali terpusat.",
                  "parentOrganization": {
                    "@type": "Organization",
                    "name": "Bali Technology",
                    "url": "https://bali.technology"
                  },
                  "memberOf": {
                    "@type": "Corporation",
                    "@id": "https://indonesianvisas.com/#organization",
                    "name": "PT Indonesian Visas Agency",
                    "url": "https://indonesianvisas.com"
                  },
                  "founder": {
                    "@type": "Person",
                    "name": "Bayu Damopolii-Manoppo",
                    "jobTitle": "Founder & Strategic Director",
                    "url": "https://www.linkedin.com/in/balihelp/"
                  },
                  "location": {
                    "@type": "Place",
                    "address": {
                      "@type": "PostalAddress",
                      "addressRegion": "Bali",
                      "addressCountry": "ID"
                    }
                  },
                  "sameAs": ["https://indonesianvisas.com", "https://bali.enterprises", "https://bali.technology"]
                },
                {
                  "@type": "WebSite",
                  "@id": "https://console.myai.bali.technology/#website",
                  "url": "https://console.myai.bali.technology",
                  "name": "MyAI OS Console",
                  "publisher": { "@id": "https://myai.bali.technology/#organization" },
                  "inLanguage": "id-ID"
                },
                {
                  "@type": "SoftwareApplication",
                  "@id": "https://console.myai.bali.technology/#software",
                  "name": "MyAI OS Console",
                  "applicationCategory": "BusinessApplication",
                  "operatingSystem": "Web",
                  "description": "Panel kendali AI Gateway terpusat: manajemen multi-provider AI (Gemini, GPT, Claude, dan lainnya), routing tugas berbasis field, knowledge base bersama, dan data center ekstraksi dokumen untuk seluruh ekosistem Bali Enterprises Group.",
                  "creator": { "@id": "https://myai.bali.technology/#organization" },
                  "featureList": [
                    "Multi-provider AI routing dengan failover otomatis",
                    "Shared knowledge base lintas aplikasi",
                    "Data center ekstraksi dokumen terpusat",
                    "Audit log dan monitoring kesehatan sistem real-time"
                  ]
                }
              ]
            })
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import LoginScreen from "@/components/LoginScreen";

export default async function LoginPage() {
  // If already logged in, go to dashboard
  const session = await getServerSession();
  if (session) redirect("/dashboard");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://myai.bali.technology/#organization",
    "name": "MyAI OS",
    "legalName": "MyAI OS - a Bali Technology product",
    "url": "https://myai.bali.technology",
    "description": "MyAI OS adalah AI Gateway terpusat untuk ekosistem Bali Enterprises Group, menyatukan integrasi kecerdasan buatan untuk seluruh produk grup (afiliasi termasuk Indonesian Visas, Tropic Tech, Wellness Bali, dan Bali Help). Dipersiapkan menjadi pelopor infrastruktur AI lokal Indonesia.",
    "parentOrganization": {
      "@type": "Organization",
      "name": "Bali Technology",
      "url": "https://bali.technology",
      "description": "Divisi riset dan pengembangan teknologi dari PT Indonesian Visas Agency."
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
    "sameAs": [
      "https://indonesianvisas.com",
      "https://bali.enterprises",
      "https://bali.technology"
    ],
    "knowsAbout": [
      "AI Gateway Infrastructure",
      "Multi-tenant AI Routing",
      "Indonesian AI Ecosystem"
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LoginScreen />
    </>
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import LoginScreen from "@/components/LoginScreen";

export default async function LoginPage() {
  // If already logged in, go to dashboard
  const session = await getServerSession();
  if (session) redirect("/dashboard");

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://console.myai.bali.technology/#organization",
    "name": "MyAI OS",
    "legalName": "MyAI OS - a Bali Technology product",
    "url": "https://console.myai.bali.technology",
    "description": "MyAI OS adalah AI Gateway terpusat untuk ekosistem Bali Enterprises Group, dikembangkan oleh Bali Technology (divisi riset PT Indonesian Visas Agency) dengan IndoDesign.website sebagai kontributor antarmuka. Menyinergikan integrasi kecerdasan buatan terpadu untuk pelopor infrastruktur AI lokal Indonesia.",
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
      "name": "Bayu Manoppo",
      "jobTitle": "Founder & Strategic Director",
      "url": "https://www.linkedin.com/in/balihelp/"
    },
    "location": {
      "@type": "Place",
      "name": "Bali, Indonesia",
      "hasMap": "https://maps.app.goo.gl/n3NNdr7uUuN2mhnQ8",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Bali",
        "addressCountry": "ID"
      }
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

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Bali Technology",
        "item": "https://bali.technology"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "MyAI OS",
        "item": "https://console.myai.bali.technology"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Login",
        "item": "https://console.myai.bali.technology/login"
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <LoginScreen />
    </>
  );
}

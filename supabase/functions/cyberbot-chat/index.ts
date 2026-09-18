import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es "Jarvis", l'assistant IA du portfolio de Florian GIRARDOT LAHOGUE.

## Identité
- Nom : Jarvis
- Personnalité : Intelligent, polyvalent et professionnel, avec une expertise en cybersécurité.
- Style : Réponses claires, structurées et engageantes. Tu utilises le markdown pour formater tes réponses (listes, gras, code, etc.).

## Capacités
Tu es une IA polyvalente capable de :
- Répondre à des questions générales sur tous les sujets (science, technologie, culture, histoire, etc.)
- Expliquer des concepts techniques (réseaux, cybersécurité, programmation, etc.)
- Aider à résoudre des problèmes de code ou de configuration
- Donner des conseils et recommandations
- Avoir des conversations naturelles et engageantes
- Présenter le profil et les compétences de Florian quand on le demande

## Informations sur le propriétaire du portfolio
- Nom complet : Florian GIRARDOT LAHOGUE
- Formation : Étudiant en BUT Réseaux & Télécommunications, parcours Cybersécurité, à l'IUT de La Réunion (2024-2027)
- Localisation : La Réunion, France
- Contact : f.girardot--lahogue@rt-iut.re (deux tirets)
- GitHub : https://github.com/JLFlo12
- LinkedIn : https://www.linkedin.com/in/florian-girardot-lahogue-4aa367341/

## Compétences Techniques de Florian
- Réseaux / GNS3 / pfSense / VLAN / DHCP / IPv6 : Maîtrisé
- Linux Debian / Kali : Maîtrisé
- Windows Server : Avancé
- HTML / CSS : Maîtrisé
- JavaScript / TypeScript : Base
- PHP & SQL : Base
- Asterisk / Apache / Nginx : Avancé
- Virtualisation : Maîtrisé (Avancé)
- Git : Maîtrisé
- Wireshark : Maîtrisé
- VS Code : Maîtrisé
- Raspberry Pi : Avancé

## Soft Skills de Florian
- Leadership : Base
- Communication : Avancé
- Travail d'équipe : Maîtrisé
- Discipline : Maîtrisé
- Esprit critique : Avancé

## Projets notables de Florian
- "The Forgotten" : Jeu survival horror en Unreal Engine 5 (en équipe de 3, 10 mois de développement)
- Réseau entreprise GNS3 : Infrastructure réseau complète avec routage, VLAN, NAT
- Pilotage LED Raspberry Pi : Contrôle de LED à distance via serveur web
- Portfolio personnel : Site web moderne avec React/TypeScript (version 2 : planète 3D, animations GSAP)

## Règles
- Réponds dans la langue utilisée par le visiteur.
- Sois polyvalent : réponds à tout type de question, pas seulement celles sur Florian.
- Quand on te demande des infos sur Florian, utilise les données ci-dessus. Si tu n'as pas l'info, dis-le.
- Le site peut t'envoyer un message système avec des informations à jour (date, projets, compétences) : elles sont prioritaires.
- Reste professionnel, accueillant et engageant.
- Utilise le markdown pour structurer tes réponses (titres, listes, gras, code, etc.).
- Tu peux ajouter des touches d'humour.`;

// Date et heure de La Réunion, recalculées à chaque requête (sinon le modèle croit être à sa date d'entraînement)
const today = () =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Indian/Reunion" }).format(new Date());

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `${SYSTEM_PROMPT}

## Date du jour
${today()}` },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA épuisés." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erreur du service IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("cyberbot-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

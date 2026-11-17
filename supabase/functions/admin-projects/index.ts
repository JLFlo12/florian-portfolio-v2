import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ───────────────────────────────────────────────────────────────
   Mode admin du portfolio : création, modification, suppression de projets
   et envoi des images (URL signée, le bucket n'accepte plus d'écriture anonyme).
   - mot de passe comparé à temps constant ;
   - 5 mauvais mots de passe par IP et par 15 min, 30 au total par heure ;
   - origines limitées au site (CORS), champs des projets filtrés.
   ─────────────────────────────────────────────────────────────── */

const ALLOWED_ORIGINS = new Set([
  "https://www.florianlh.fr",
  "https://florianlh.fr",
  "https://florian-portfolio-v2.vercel.app",
  "https://florian-portfolio-zeta.vercel.app",
]);
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

const cors = (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) || LOCAL.test(origin) ? origin : "https://www.florianlh.fr",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-password",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

const clientIp = (req: Request) =>
  req.headers.get("cf-connecting-ip")
  ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  ?? "unknown";

// Comparaison à temps constant : les deux valeurs sont hachées (même longueur), puis comparées octet par octet
async function safeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// Colonnes modifiables d'un projet (tout le reste est ignoré)
const FIELDS = [
  "title", "description_fr", "description_en", "tags", "thumbnail_url", "slideshow_url",
  "slideshow_type", "status", "detailed_content", "gallery_images", "display_order",
];
const pick = (body: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(body).filter(([k]) => FIELDS.includes(k)));

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif",
};

const FAIL_IP = { max: 5, window: 15 * 60 };
const FAIL_ALL = { max: 30, window: 60 * 60 };

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405, headers);
  if (Number(req.headers.get("content-length") ?? 0) > 512_000) return json({ error: "Requête trop lourde" }, 413, headers);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const ip = clientIp(req);
  // Base injoignable : on refuse (« bloqué »), pour ne jamais laisser des essais illimités
  const rpc = async (fn: string, key: string, { max, window }: { max: number; window: number }) => {
    const { data, error } = await supabase.rpc(fn, { p_key: key, p_max: max, p_window_seconds: window });
    if (error) { console.error(fn, error.message); return fn === "rate_limit_blocked"; }
    return data === true;
  };

  // Trop d'essais récents : on refuse sans même regarder le mot de passe
  if (await rpc("rate_limit_blocked", `admin-fail:${ip}`, FAIL_IP) || await rpc("rate_limit_blocked", "admin-fail:all", FAIL_ALL)) {
    return json({ error: "Trop de tentatives, réessayez plus tard." }, 429, { ...headers, "Retry-After": "900" });
  }

  const expected = Deno.env.get("ADMIN_PASSWORD") ?? "";
  const given = req.headers.get("x-admin-password") ?? "";
  if (!expected || !given || !(await safeEqual(given, expected))) {
    await rpc("hit_rate_limit", `admin-fail:${ip}`, FAIL_IP);
    await rpc("hit_rate_limit", "admin-fail:all", FAIL_ALL);
    return json({ error: "Mot de passe incorrect" }, 401, headers);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corps vide */ }
  const action = new URL(req.url).searchParams.get("action") ?? body.action;

  try {
    if (action === "verify") return json({ success: true }, 200, headers);

    if (action === "create") {
      const { data, error } = await supabase.from("projects").insert(pick(body)).select().single();
      if (error) throw error;
      return json(data, 200, headers);
    }

    if (action === "update") {
      if (typeof body.id !== "string") return json({ error: "id manquant" }, 400, headers);
      const { data, error } = await supabase.from("projects").update(pick(body)).eq("id", body.id).select().single();
      if (error) throw error;
      return json(data, 200, headers);
    }

    if (action === "delete") {
      if (typeof body.id !== "string") return json({ error: "id manquant" }, 400, headers);
      const { error } = await supabase.from("projects").delete().eq("id", body.id);
      if (error) throw error;
      return json({ success: true }, 200, headers);
    }

    // URL d'envoi signée pour une image (le navigateur envoie ensuite le fichier directement)
    if (action === "upload-url") {
      const ext = IMAGE_TYPES[String(body.contentType)];
      if (!ext) return json({ error: "Format d'image non pris en charge" }, 400, headers);
      const base = String(body.fileName ?? "image").replace(/\.[^.]*$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "image";
      const path = `${Date.now()}-${base}.${ext}`;
      const bucket = supabase.storage.from("project-thumbnails");
      const { data, error } = await bucket.createSignedUploadUrl(path);
      if (error) throw error;
      return json({ path: data.path, token: data.token, publicUrl: bucket.getPublicUrl(data.path).data.publicUrl }, 200, headers);
    }

    return json({ error: "Action invalide" }, 400, headers);
  } catch (error) {
    console.error("admin-projects:", error);
    return json({ error: error instanceof Error ? error.message : "Erreur serveur" }, 500, headers);
  }
});

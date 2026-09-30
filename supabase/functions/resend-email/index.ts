// Supabase Edge Function: resend-email
// Serves as a serverless Resend email dispatcher compliant with VersalBank requirements
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    // Secrets / Environment Variables
    const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") || "notifications@versalbank.com";
    const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") || "contact@versalbank.com";
    const ADMIN_ALERT_EMAIL = Deno.env.get("ADMIN_ALERT_EMAIL") || "contact@versalbank.com";

    const {
      to,
      subject,
      html,
      text,
      from,
      reply_to,
      replyTo,
      notifyAdmin = false,
      adminTitle,
    } = await req.json();

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (to, subject, html/text)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedSender = from || (SENDER_EMAIL.includes("<") ? SENDER_EMAIL : `VERSALBANK <${SENDER_EMAIL}>`);
    const formattedReplyTo = reply_to || replyTo || SUPPORT_EMAIL;

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured. Simulated dispatch for:", to);
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: "Email dispatch simulated (Configure RESEND_API_KEY in Supabase secrets).",
          recipient: to,
          from: formattedSender,
          reply_to: formattedReplyTo,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Send automatic email to client using SENDER_EMAIL with reply_to: SUPPORT_EMAIL
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: formattedSender,
        to: Array.isArray(to) ? to : [to],
        reply_to: formattedReplyTo,
        subject: subject,
        html: html || undefined,
        text: text || undefined,
      }),
    });

    const data = await res.json();

    // 2. Notifications internes/administrateur envoyées à ADMIN_ALERT_EMAIL
    if (notifyAdmin && to !== ADMIN_ALERT_EMAIL) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: formattedSender,
            to: [ADMIN_ALERT_EMAIL],
            reply_to: SUPPORT_EMAIL,
            subject: `[VERSALBANK ALERT] ${adminTitle || subject}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
                <h3 style="color: #0f2b5c; margin-top: 0;">Notification administrative VersalBank</h3>
                <p><strong>Destinataire client :</strong> ${Array.isArray(to) ? to.join(", ") : to}</p>
                <p><strong>Objet :</strong> ${subject}</p>
                <p><strong>Expéditeur auto :</strong> ${formattedSender}</p>
                <p><strong>Réponse vers support :</strong> ${formattedReplyTo}</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                <div style="background-color: #ffffff; padding: 16px; border-radius: 6px; border: 1px solid #e2e8f0;">
                  ${html || `<pre>${text}</pre>`}
                </div>
              </div>
            `,
          }),
        });
      } catch (adminErr) {
        console.warn("Failed to dispatch admin notification:", adminErr);
      }
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

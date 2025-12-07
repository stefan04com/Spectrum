import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, childName, childData } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Received chat request for child:", childName);
    console.log("Message:", message);

    const systemPrompt = `You are an empathetic and professional AI assistant helping parents understand their children's emotional state and activities. These are children with autism, so be understanding and provide helpful insights.

You always respond in English and are warm, understanding, and offer practical advice.

Information about ${childName}:
- Age: ${childData.age} years old
- Last activity: ${childData.lastActivity}

Recent emotional state data:
${JSON.stringify(childData.moodData, null, 2)}

Recently completed activities:
${JSON.stringify(childData.activities, null, 2)}

Daily report:
- Overall emotional score: ${childData.dailyReport.overallMood}%
- Activities completed: ${childData.dailyReport.activitiesCompleted}
- Time spent: ${childData.dailyReport.timeSpent} minutes
- Emotion distribution: Happy ${childData.dailyReport.moodBreakdown.happy}%, Calm ${childData.dailyReport.moodBreakdown.calm}%, Anxious ${childData.dailyReport.moodBreakdown.anxious}%, Sad ${childData.dailyReport.moodBreakdown.sad}%, Angry ${childData.dailyReport.moodBreakdown.angry}%

Answer the parent's questions about their child's state, activities completed, and offer suggestions if requested. Be empathetic and encouraging.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Insufficient credits. Please add credits in settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Error processing request" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response back to client");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a dairy milk rate chart parser. Extract FAT/SNF rate chart data from the given image.
            
Return a JSON object with these fields:
- baseFatRate: number (the rate per liter at FAT=1 and base SNF. To find this: look at any cell in the chart, divide the rate by the FAT value for that row. For example, if FAT=6.5 and rate=52, then baseFatRate = 52/6.5 = 8)
- baseSNF: number (the SNF value at which the highest rates appear in each FAT row. This is typically the rightmost or highest SNF column, e.g. 9.5)
- snfDeductionPerPoint: number (how much the rate per liter decreases when SNF drops by 0.1. Calculate by comparing two adjacent SNF columns for the same FAT: e.g. if rate at SNF 9.5 is 52 and at SNF 9.4 is 51.8, then deduction = (52-51.8)/1 = 0.2 per 0.1 SNF drop)
- fatMin: number (the smallest FAT value shown in the chart rows)
- fatMax: number (the largest FAT value shown in the chart rows)
- fatStep: number (the increment between consecutive FAT rows, e.g. 0.1 or 0.5)
- snfMin: number (the smallest SNF value shown in the chart columns)
- snfMax: number (the largest SNF value shown in the chart columns)

STEP BY STEP:
1. First identify all FAT values (rows) and SNF values (columns) in the table
2. Read at least 5-6 actual cell values carefully from the image
3. Calculate baseFatRate by dividing a rate by its FAT value (at the highest SNF): rate / FAT = baseFatRate
4. Calculate snfDeductionPerPoint by comparing rates at adjacent SNF values for same FAT
5. Verify your calculations match multiple cells in the chart

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation. Double-check all numbers.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this rate chart image and extract the FAT/SNF rate settings. Return only JSON."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Try to parse JSON from the response
    let parsed;
    try {
      // Remove markdown code blocks if present
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Could not parse chart data", raw: content }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, settings: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

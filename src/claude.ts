import Anthropic from "@anthropic-ai/sdk";
import { UserProfile, MealEntry, Message } from "./types";
import { appendConversationMessage } from "./db";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const MODEL = "claude-sonnet-4-6";

export function buildSystemPrompt(user: UserProfile): string {
  const personalityMap: Record<string, string> = {
    friendly_coach: "מאמן תזונה חברותי וחם — עודד, תמוך, השתמש באימוג'י",
    strict_nutritionist: "תזונאי מקצועי ומדויק — נתונים, עובדות, פחות רגש",
    funny_friend: "חבר קז'ואלי ומצחיק — שמור על הומור אבל תן מידע מדויק",
    no_nonsense: "קצר וענייני בלבד — עובדות, ללא מלל מיותר",
    custom: user.customPersonality ?? "עזר למשתמש בצורה ידידותית ומקצועית",
  };

  const dietMap: Record<string, string> = {
    caloric_balance: `מאזן קלורי עם יעד של ${user.calorieGoal ?? 2000} קק״ל ליום`,
    keto: "דיאטת קטו — פחמימות נמוכות מאוד (מתחת ל-20g ליום), שומן גבוה, חלבון בינוני",
    intermittent_fasting: `צום לסירוגין — חלון אכילה: ${user.customDietRules ?? "לא צוין"}`,
    plant_based: "תזונה צמחית — ללא בשר, עדיפות לחלבון מהצומח",
    high_protein: "עתיר חלבון — לפחות 2g חלבון לכל ק״ג משקל גוף ביום",
    custom: `כללי דיאטה מותאמים אישית: ${user.customDietRules ?? "לא צוין"}`,
  };

  const goalMap: Record<string, string> = {
    lose_weight: "לרדת במשקל",
    build_muscle: "לבנות שריר",
    maintain_weight: "לשמור על משקל",
    eat_healthier: "לאכול בריא יותר",
    more_energy: "יותר אנרגיה",
  };

  return `
אתה DayBite — בוט תזונה אישי בטלגרם.
שמו של המשתמש הוא ${user.name}.
הגישה התזונתית שלו: ${dietMap[user.dietType]}.
המטרה שלו: ${goalMap[user.goal]}.
הסגנון שלך: ${personalityMap[user.botPersonality]}.

חוקים קריטיים:
1. תמיד ענה בעברית בלבד, ללא יוצא מן הכלל
2. פורמט הודעות לטלגרם — קצר, ברור, עם אימוג'י לכותרות
3. כאשר מתבקש לחלץ נתוני אוכל — החזר JSON בלבד, ללא טקסט נוסף
4. הערכות קלוריות צריכות להיות ריאליות — דגל אם ערך נראה חריג
5. אל תמציא נתונים תזונתיים — אם אינך בטוח, ציין זאת
6. אתה עוקב אחר תחושות המשתמש לאחר ארוחות (נפיחות, צרבת, עייפות וכו'). אם מזהה דפוס חוזר — למשל "בכל פעם שאכלת X דיווחת על Y" — ציין זאת בעדינות ובאחריות. אל תאבחן מחלות.
`.trim();
}

async function callClaude(
  systemPrompt: string,
  messages: Message[],
  userMessage: string,
  retryCount = 0
): Promise<string> {
  try {
    const apiMessages: Anthropic.MessageParam[] = [
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: apiMessages,
    });

    const content = response.content[0];
    if (content.type === "text") {
      return content.text;
    }
    throw new Error("Unexpected response type from Claude");
  } catch (error) {
    console.error("Claude API error:", error);
    if (retryCount < 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return callClaude(systemPrompt, messages, userMessage, retryCount + 1);
    }
    throw error;
  }
}

export async function parseFoodLog(
  userMessage: string,
  user: UserProfile
): Promise<MealEntry[]> {
  const systemPrompt = buildSystemPrompt(user);

  const extractionPrompt = `
המשתמש שלח את ההודעה הבאה:
"${userMessage}"

חלץ את כל פריטי האוכל מהודעה זו והחזר JSON בלבד (ללא כל טקסט נוסף, ללא markdown, ללא backticks).
הפורמט:
[
  {
    "description": "תיאור המאכל בעברית",
    "timeOfDay": "בוקר" | "צהריים" | "ערב" | "נשנוש",
    "calories": מספר,
    "protein_g": מספר,
    "carbs_g": מספר,
    "fat_g": מספר,
    "notes": "הערות רלוונטיות אם יש"
  }
]

חוקים:
- אם לא ניתן לזהות אוכל — החזר מערך ריק []
- הערכות קלוריות צריכות להיות ריאליסטיות
- אל תמציא נתונים — השתמש בערכים ממוצעים מקובלים
- timeOfDay: בחר לפי ההקשר (בוקר/צהריים/ערב/נשנוש)
`.trim();

  const responseText = await callClaude(systemPrompt, [], extractionPrompt);

  // Extract JSON from response (handle potential markdown wrapping)
  let jsonText = responseText.trim();
  const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    jsonText = jsonMatch[0];
  }

  const parsed = JSON.parse(jsonText);
  const now = new Date().toISOString();

  return parsed.map((item: any) => ({
    description: item.description || "לא ידוע",
    timeOfDay: item.timeOfDay || "נשנוש",
    calories: Number(item.calories) || 0,
    protein_g: Number(item.protein_g) || 0,
    carbs_g: Number(item.carbs_g) || 0,
    fat_g: Number(item.fat_g) || 0,
    notes: item.notes || undefined,
    loggedAt: now,
  }));
}

export async function generateMealPlan(
  user: UserProfile,
  todayLog: MealEntry[]
): Promise<string> {
  const systemPrompt = buildSystemPrompt(user);

  const totalCalories = todayLog.reduce((sum, e) => sum + e.calories, 0);
  const totalProtein = todayLog.reduce((sum, e) => sum + e.protein_g, 0);
  const totalCarbs = todayLog.reduce((sum, e) => sum + e.carbs_g, 0);
  const totalFat = todayLog.reduce((sum, e) => sum + e.fat_g, 0);

  const logSummary = todayLog.map((e) => {
    let line = `- ${e.timeOfDay}: ${e.description} (${e.calories} קק״ל)`;
    if (e.symptom && e.symptom !== "רגיל") line += ` [תחושה לאחר: ${e.symptom}]`;
    return line;
  }).join("\n");

  const planPrompt = `
צור תוכנית ארוחות להמשך היום עבור ${user.name}.

מה שנאכל עד כה היום:
${logSummary || "לא נאכל עדיין"}

סיכום עד כה:
- קלוריות: ${Math.round(totalCalories)} קק״ל
- חלבון: ${Math.round(totalProtein)}g
- פחמימות: ${Math.round(totalCarbs)}g
- שומן: ${Math.round(totalFat)}g

צור תוכנית ארוחות ריאלית ומותאמת אישית להמשך היום.
כלול:
1. ארוחות מומלצות עם כמויות משוערות
2. ערכים תזונתיים לכל ארוחה
3. טיפים קצרים
4. סיכום צפוי סוף יום

פרמט בצורה ברורה לטלגרם עם אימוג'י.
`.trim();

  const history = user.conversationHistory.slice(-6);
  const response = await callClaude(systemPrompt, history, planPrompt);

  appendConversationMessage(user.telegramId, "user", planPrompt);
  appendConversationMessage(user.telegramId, "assistant", response);

  return response;
}

export async function generateResponse(
  userMessage: string,
  user: UserProfile
): Promise<string> {
  const systemPrompt = buildSystemPrompt(user);
  const history = user.conversationHistory.slice(-8);

  const response = await callClaude(systemPrompt, history, userMessage);

  appendConversationMessage(user.telegramId, "user", userMessage);
  appendConversationMessage(user.telegramId, "assistant", response);

  return response;
}

export async function generateRefinedPlan(
  refinement: string,
  originalPlan: string,
  user: UserProfile
): Promise<string> {
  const systemPrompt = buildSystemPrompt(user);

  const refinePrompt = `
התוכנית הקודמת הייתה:
${originalPlan}

המשתמש ביקש שינוי: "${refinement}"

עדכן את תוכנית הארוחות בהתאם לבקשה. שמור על אותו פורמט.
`.trim();

  const history = user.conversationHistory.slice(-6);
  const response = await callClaude(systemPrompt, history, refinePrompt);

  appendConversationMessage(user.telegramId, "user", refinement);
  appendConversationMessage(user.telegramId, "assistant", response);

  return response;
}

# DayBite — Telegram Nutrition Bot

## LANGUAGE REQUIREMENT (CRITICAL)
The entire bot must operate in Hebrew (עברית) at all times.
- ALL messages, buttons, menus, confirmations, errors, summaries, and meal plans → Hebrew only
- Numbers, units, and technical terms may stay in Latin characters (e.g., kcal, 250g, API)
- Food names from other languages → transliterate into Hebrew characters (e.g., "פסטה", "סושי", "קינואה")
- Never mix Hebrew and English mid-sentence
- Claude's responses must always be in Hebrew regardless of what language the user writes in

---

## Overview
Build a production-ready Telegram nutrition bot called "DayBite" using Node.js and TypeScript.
The bot supports multiple users simultaneously, each with their own profile, dietary settings, and daily food log.
All interaction happens in Hebrew via Telegram inline keyboards and free-text messages.

---

## Tech Stack
- Node.js + TypeScript
- `telegraf` — Telegram Bot framework
- Anthropic Claude API (`claude-sonnet-4-20250514`) — food parsing and meal planning
- `better-sqlite3` — lightweight local DB for multi-user persistence
- `dotenv` — environment config

---

## Multi-User Architecture

Each Telegram user is identified by their unique `ctx.from.id`.
Store per-user data in a local SQLite database (`./data/daybite.db`):
```ts
interface UserProfile {
  telegramId: number;
  name: string;                   // how to address the user (Hebrew name)
  dietType: DietType;             // chosen dietary approach
  calorieGoal?: number;           // daily kcal target (if relevant)
  customDietRules?: string;       // free-text custom rules in Hebrew
  goal: UserGoal;                 // main health/fitness goal
  botPersonality: BotPersonality; // tone and style of responses
  currentDayLog: MealEntry[];     // today's food log (auto-resets at midnight)
  lastLogDate: string;            // ISO date string YYYY-MM-DD
  conversationHistory: Message[]; // last 10 turns for Claude context
  createdAt: string;
}

type DietType =
  | "caloric_balance"
  | "keto"
  | "intermittent_fasting"
  | "plant_based"
  | "high_protein"
  | "custom";

type UserGoal =
  | "lose_weight"
  | "build_muscle"
  | "maintain_weight"
  | "eat_healthier"
  | "more_energy";

type BotPersonality =
  | "friendly_coach"       // חם, מעודד, תומך
  | "strict_nutritionist"  // מקצועי, מדויק, נתונים
  | "funny_friend"         // קז'ואל, הומוריסטי
  | "no_nonsense";         // קצר, עובדות בלבד

interface MealEntry {
  description: string;
  timeOfDay: "בוקר" | "צהריים" | "ערב" | "נשנוש";
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes?: string;
  loggedAt: string; // ISO timestamp
}
```

---

## Onboarding Flow — אשף הגדרות ראשוני

Triggered on `/התחל` for first-time users. Use Telegraf scenes (wizard scene) for step-by-step flow.
Returning users skip directly to the main menu.

### שלב 1 — שם
*(free text reply — store as `name`)*

### שלב 2 — סוג דיאטה
Inline keyboard (2 per row):
- If **מאזן קלורי**: follow-up → `"מה יעד הקלוריות היומי שלך? (ברירת מחדל: 2000)"`
- If **צום לסירוגין**: follow-up → `"מה חלון האכילה שלך? (למשל: 12:00–20:00)"`
- If **מותאם אישית**: follow-up → `"תאר את כללי הדיאטה שלך בחופשיות:"`

### שלב 3 — יעד
Inline keyboard:
### שלב 4 — אופי הבוט
### שלב 5 — אישור
---

## פקודות הבוט

Register all commands with BotFather in Hebrew:

| פקודה | תיאור |
|---|---|
| `/התחל` | הרשמה / כניסה חוזרת |
| `/יומן` | תיעוד אוכל |
| `/סיכום` | סיכום יומי עם ערכים תזונתיים |
| `/תכנון` | תכנון המשך היום |
| `/הגדרות` | עריכת הפרופיל שלי |
| `/איפוס` | איפוס יומן היום |
| `/עזרה` | כל הפקודות |

Also support English aliases: `/start`, `/log`, `/summary`, `/plan`, `/settings`, `/reset`, `/help`

---

## תיעוד אוכל (`/יומן` או הודעת טקסט חופשית)

The bot should respond to ANY free-text message as a potential food log entry.

**Flow:**
1. User sends: `"אכלתי בוקר שתי ביצים עם לחם, בצהריים שניצל עם אורז ובערב יוגורט"`
2. Send typing indicator: `ctx.sendChatAction("typing")`
3. Call Claude to extract structured JSON:
```json
[
  {
    "description": "שתי ביצים עם לחם",
    "timeOfDay": "בוקר",
    "calories": 340,
    "protein_g": 18,
    "carbs_g": 30,
    "fat_g": 14,
    "notes": "מקור חלבון טוב, פחמימות מורכבות"
  },
  {
    "description": "שניצל עם אורז",
    "timeOfDay": "צהריים",
    "calories": 580,
    "protein_g": 38,
    "carbs_g": 52,
    "fat_g": 18,
    "notes": ""
  },
  {
    "description": "יוגורט",
    "timeOfDay": "ערב",
    "calories": 120,
    "protein_g": 10,
    "carbs_g": 14,
    "fat_g": 2,
    "notes": "פרוביוטיקה, סידן"
  }
]
```

4. Append to user's `currentDayLog`
5. Reply with formatted Hebrew message:---

## תכנון המשך היום (`/תכנון`)

1. If no food logged today → reply:
2. Call Claude with full context → generate personalized Hebrew meal plan
3. Reply with structured plan, then inline buttons:
4. Support free-text follow-up refinements:
`"אני לא אוהב דגים"` / `"יש לי רק 10 דקות לבישול"` / `"אין לי בצל בבית"`

---

## הגדרות (`/הגדרות`)
Inline keyboard (one per row):
---

## Claude Prompt Strategy

Build a dynamic Hebrew system prompt per user:
```ts
function buildSystemPrompt(user: UserProfile): string {
  const personalityMap = {
    friendly_coach: "מאמן תזונה חברותי וחם — עודד, תמוך, השתמש באימוג'י",
    strict_nutritionist: "תזונאי מקצועי ומדויק — נתונים, עובדות, פחות רגש",
    funny_friend: "חבר קז'ואלי ומצחיק — שמור על הומור אבל תן מידע מדויק",
    no_nonsense: "קצר וענייני בלבד — עובדות, ללא מלל מיותר"
  };

  const dietMap = {
    caloric_balance: `מאזן קלורי עם יעד של ${user.calorieGoal} קק״ל ליום`,
    keto: "דיאטת קטו — פחמימות נמוכות מאוד (מתחת ל-20g ליום), שומן גבוה, חלבון בינוני",
    intermittent_fasting: `צום לסירוגין — חלון אכילה: ${user.customDietRules}`,
    plant_based: "תזונה צמחית — ללא בשר, עדיפות לחלבון מהצומח",
    high_protein: "עתיר חלבון — לפחות 2g חלבון לכל ק״ג משקל גוף ביום",
    custom: `כללי דיאטה מותאמים אישית: ${user.customDietRules}`
  };

  return `
אתה DayBite — בוט תזונה אישי בטלגרם.
שמו של המשתמש הוא ${user.name}.
הגישה התזונתית שלו: ${dietMap[user.dietType]}.
המטרה שלו: ${user.goal}.
הסגנון שלך: ${personalityMap[user.botPersonality]}.

חוקים קריטיים:
1. תמיד ענה בעברית בלבד, ללא יוצא מן הכלל
2. פורמט הודעות לטלגרם — קצר, ברור, עם אימוג'י לכותרות
3. כאשר מתבקש לחלץ נתוני אוכל — החזר JSON בלבד, ללא טקסט נוסף
4. הערכות קלוריות צריכות להיות ריאליות — דגל אם ערך נראה חריג
5. אל תמציא נתונים תזונתיים — אם אינך בטוח, ציין זאת
  `.trim();
}
```

Maintain per-user conversation history — last 10 turns — stored in DB and sent with each API call.

---

## Data Persistence (SQLite)

Tables:
- `users` — full UserProfile per Telegram ID
- `meal_logs` — individual MealEntry records with date + telegramId
- `conversation_history` — last 10 messages per user

Auto-reset `currentDayLog` if `lastLogDate !== today` (check on every interaction).

---

## File Structure
---

## Environment Variables
```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
ANTHROPIC_API_KEY=your_anthropic_api_key
```

---

## Error Handling & Edge Cases

- Claude API failure → retry once → send: `"סליחה, נתקלתי בבעיה זמנית. נסה שוב בעוד רגע 🙏"`
- Ambiguous food input → ask: `"לא הצלחתי להבין מה אכלת — תוכל לפרט קצת יותר?"`
- Unrealistic calorie estimate (>3000 single meal) → flag: `"זה נראה הרבה — בדקתי שוב ונראה שזה [X] קק״ל. נכון?"`
- User writes in English → respond in Hebrew regardless
- Concurrent users → fully async, no shared mutable state
- Graceful shutdown on `SIGINT` with DB close

---

## README Requirements (בעברית)

כלול:
1. דרישות מוקדמות — Node.js 18+, יצירת בוט דרך BotFather
2. שלבי התקנה
3. הרצה מקומית: `npx ts-node src/index.ts`
4. הוספת משתמש חדש — פשוט לשלוח הודעה לבוט!
5. דוגמאות שימוש

---

## Deliverable

בוט טלגרם פעיל שעומד בכל הדרישות הבאות:
- ✅ כל הממשק בעברית מלאה
- ✅ אשף הגדרות ראשוני לכל משתמש חדש
- ✅ תמיכה במספר משתמשים במקביל באופן עצמאי
- ✅ תיעוד אוכל בשפה טבעית עם ניתוח קלורי/מאקרו
- ✅ תכנון המשך היום לפי הגדרות אישיות
- ✅ שמירת נתונים בין הפעלות
- ✅ מוכן להרצה מקומית ולדפלוי על שרת

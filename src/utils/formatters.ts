import { MealEntry, UserProfile } from "../types";

export function formatMealEntry(entry: MealEntry): string {
  const timeEmoji: Record<string, string> = {
    "בוקר": "🌅",
    "צהריים": "☀️",
    "ערב": "🌙",
    "נשנוש": "🍎",
  };

  const emoji = timeEmoji[entry.timeOfDay] || "🍽️";
  const symptomEmoji: Record<string, string> = {
    "רגיל": "✅",
    "נפיחות": "😮‍💨",
    "צרבת": "🔥",
    "עייפות": "😴",
    "אחר": "🔸",
  };

  let text = `${emoji} *${entry.timeOfDay}* — ${entry.description}\n`;
  text += `   🔥 ${Math.round(entry.calories)} קק״ל | 💪 חלבון: ${Math.round(entry.protein_g)}g | 🌾 פחמימות: ${Math.round(entry.carbs_g)}g | 🥑 שומן: ${Math.round(entry.fat_g)}g`;
  if (entry.notes) {
    text += `\n   📝 ${entry.notes}`;
  }
  if (entry.symptom && entry.symptom !== "רגיל") {
    text += `\n   🌡️ תחושה לאחר: ${symptomEmoji[entry.symptom] ?? "🔸"} ${entry.symptom}`;
  }
  return text;
}

export function formatDailySummary(user: UserProfile, log: MealEntry[]): string {
  if (log.length === 0) {
    return `📋 *סיכום יומי — ${getTodayHebrew()}*\n\nעוד לא תיעדת אוכל היום.\nשלח לי מה אכלת ואני אחשב את הערכים התזונתיים! 🍽️`;
  }

  const totalCalories = log.reduce((sum, e) => sum + e.calories, 0);
  const totalProtein = log.reduce((sum, e) => sum + e.protein_g, 0);
  const totalCarbs = log.reduce((sum, e) => sum + e.carbs_g, 0);
  const totalFat = log.reduce((sum, e) => sum + e.fat_g, 0);

  let text = `📋 *סיכום יומי — ${getTodayHebrew()}*\n\n`;

  text += `*ארוחות היום:*\n`;
  for (const entry of log) {
    text += formatMealEntry(entry) + "\n\n";
  }

  text += `─────────────────\n`;
  text += `*סה״כ:*\n`;
  text += `🔥 קלוריות: ${Math.round(totalCalories)} קק״ל\n`;
  text += `💪 חלבון: ${Math.round(totalProtein)}g\n`;
  text += `🌾 פחמימות: ${Math.round(totalCarbs)}g\n`;
  text += `🥑 שומן: ${Math.round(totalFat)}g\n`;

  if (user.dietType === "caloric_balance" && user.calorieGoal) {
    const remaining = user.calorieGoal - totalCalories;
    const percentage = Math.round((totalCalories / user.calorieGoal) * 100);
    text += `\n📊 *יעד קלורי:* ${user.calorieGoal} קק״ל\n`;
    if (remaining > 0) {
      text += `✅ נותרו: ${Math.round(remaining)} קק״ל (${percentage}% מהיעד)\n`;
    } else {
      text += `⚠️ חרגת מהיעד ב-${Math.round(Math.abs(remaining))} קק״ל\n`;
    }
  }

  const symptomsLogged = log.filter((e) => e.symptom && e.symptom !== "רגיל");
  if (symptomsLogged.length > 0) {
    text += `\n🌡️ *תחושות לאחר ארוחות:*\n`;
    for (const e of symptomsLogged) {
      text += `• ${e.timeOfDay} (${e.description}): ${e.symptom}\n`;
    }
  }

  return text;
}

export function formatLoggedMeals(entries: MealEntry[]): string {
  if (entries.length === 0) {
    return "לא הצלחתי לזהות פריטי אוכל בהודעה שלך. תוכל לפרט קצת יותר?";
  }

  const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);
  const totalProtein = entries.reduce((sum, e) => sum + e.protein_g, 0);
  const totalCarbs = entries.reduce((sum, e) => sum + e.carbs_g, 0);
  const totalFat = entries.reduce((sum, e) => sum + e.fat_g, 0);

  let text = `✅ *תועד בהצלחה!*\n\n`;

  for (const entry of entries) {
    text += formatMealEntry(entry) + "\n\n";
  }

  if (entries.length > 1) {
    text += `─────────────────\n`;
    text += `*סה״כ ארוחות אלו:*\n`;
    text += `🔥 ${Math.round(totalCalories)} קק״ל | 💪 ${Math.round(totalProtein)}g חלבון | 🌾 ${Math.round(totalCarbs)}g פחמימות | 🥑 ${Math.round(totalFat)}g שומן`;
  }

  return text;
}

export function formatHighCalorieWarning(entry: MealEntry): string {
  return `⚠️ *שים לב!* הארוחה "${entry.description}" מכילה ${Math.round(entry.calories)} קק״ל — זה נראה גבוה מאוד לארוחה אחת. בדקתי שוב וזה הנתון הטוב ביותר שמצאתי. האם הכמות נכונה?`;
}

export function formatHelpMessage(): string {
  return `
🤖 *DayBite — בוט התזונה שלך*

הנה כל מה שאני יכול לעשות:

📝 *תיעוד אוכל*
/יומן — תיעוד ארוחה
או פשוט שלח לי מה אכלת!

📊 *סיכום ותכנון*
/סיכום — סיכום תזונתי יומי
/תכנון — תכנון המשך היום

⚙️ *הגדרות*
/הגדרות — עריכת הפרופיל שלי
/איפוס — איפוס יומן היום
/עזרה — הצגת הודעה זו
/התחל — כניסה מחדש

💡 *טיפ:* אתה יכול פשוט לשלוח לי משפט כמו:
"אכלתי בוקר שתי ביצים עם לחם"
ואני אחשב את הערכים התזונתיים אוטומטית!
`.trim();
}

function getTodayHebrew(): string {
  const today = new Date();
  return today.toLocaleDateString("he-IL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatGoalLabel(goal: string): string {
  const map: Record<string, string> = {
    lose_weight: "לרדת במשקל",
    build_muscle: "לבנות שריר",
    maintain_weight: "לשמור על משקל",
    eat_healthier: "לאכול בריא יותר",
    more_energy: "יותר אנרגיה",
  };
  return map[goal] || goal;
}

export function formatDietLabel(dietType: string): string {
  const map: Record<string, string> = {
    caloric_balance: "מאזן קלורי",
    keto: "קטו",
    intermittent_fasting: "צום לסירוגין",
    plant_based: "צמחוני",
    high_protein: "עתיר חלבון",
    custom: "מותאם אישית",
  };
  return map[dietType] || dietType;
}

export function formatPersonalityLabel(personality: string, customText?: string): string {
  const map: Record<string, string> = {
    friendly_coach: "מאמן חברותי 🤗",
    strict_nutritionist: "תזונאי מקצועי 📊",
    funny_friend: "חבר מצחיק 😄",
    no_nonsense: "ישיר וקצר ⚡",
    custom: customText ? `מותאם אישית ✏️ — ${customText}` : "מותאם אישית ✏️",
  };
  return map[personality] || personality;
}

import { Context, Markup } from "telegraf";
import { getUser, updateUser } from "../db";
import {
  formatDietLabel,
  formatGoalLabel,
  formatPersonalityLabel,
} from "../utils/formatters";
import { DietType, UserGoal, BotPersonality } from "../types";

// Track which setting is being edited per user
const editingState = new Map<number, {
  field: string;
  awaitingText?: boolean;
}>();

export function getEditingState(telegramId: number) {
  return editingState.get(telegramId);
}

export function clearEditingState(telegramId: number) {
  editingState.delete(telegramId);
}

export async function settingsCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = getUser(telegramId);
  if (!user) {
    await ctx.reply(
      "לא מצאתי את הפרופיל שלך. אנא הירשם תחילה עם /התחל"
    );
    return;
  }

  const text =
    `⚙️ *הגדרות הפרופיל שלך*\n\n` +
    `👤 *שם:* ${user.name}\n` +
    `🥗 *דיאטה:* ${formatDietLabel(user.dietType)}` +
    (user.dietType === "caloric_balance" && user.calorieGoal
      ? ` (${user.calorieGoal} קק״ל)`
      : user.customDietRules
      ? ` — ${user.customDietRules}`
      : "") +
    `\n🎯 *מטרה:* ${formatGoalLabel(user.goal)}\n` +
    `💬 *סגנון:* ${formatPersonalityLabel(user.botPersonality, user.customPersonality ?? undefined)}\n\n` +
    `מה תרצה לשנות?`;

  await ctx.reply(text, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("👤 שנה שם", "settings_name")],
      [Markup.button.callback("🥗 שנה סוג דיאטה", "settings_diet")],
      [Markup.button.callback("🎯 שנה מטרה", "settings_goal")],
      [Markup.button.callback("💬 שנה סגנון בוט", "settings_personality")],
      [Markup.button.callback("❌ סגור", "settings_close")],
    ]),
  });
}

export async function handleSettingsCallback(ctx: Context, data: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await ctx.answerCbQuery();

  if (data === "settings_close") {
    await ctx.editMessageText("⚙️ ההגדרות נסגרו.");
    return;
  }

  if (data === "settings_name") {
    editingState.set(telegramId, { field: "name", awaitingText: true });
    await ctx.reply("מה השם החדש שלך?");
    return;
  }

  if (data === "settings_diet") {
    editingState.set(telegramId, { field: "diet" });
    await ctx.reply(
      "בחר סוג דיאטה חדש:",
      {
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("⚖️ מאזן קלורי", "set_diet_caloric_balance"),
            Markup.button.callback("🥑 קטו", "set_diet_keto"),
          ],
          [
            Markup.button.callback("⏰ צום לסירוגין", "set_diet_intermittent_fasting"),
            Markup.button.callback("🌱 צמחוני", "set_diet_plant_based"),
          ],
          [
            Markup.button.callback("💪 עתיר חלבון", "set_diet_high_protein"),
            Markup.button.callback("✏️ מותאם אישית", "set_diet_custom"),
          ],
        ]),
      }
    );
    return;
  }

  if (data === "settings_goal") {
    await ctx.reply(
      "בחר מטרה חדשה:",
      {
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📉 לרדת במשקל", "set_goal_lose_weight")],
          [Markup.button.callback("💪 לבנות שריר", "set_goal_build_muscle")],
          [Markup.button.callback("⚖️ לשמור על משקל", "set_goal_maintain_weight")],
          [Markup.button.callback("🥗 לאכול בריא יותר", "set_goal_eat_healthier")],
          [Markup.button.callback("⚡ יותר אנרגיה", "set_goal_more_energy")],
        ]),
      }
    );
    return;
  }

  if (data === "settings_personality") {
    await ctx.reply(
      "בחר סגנון תקשורת:",
      {
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🤗 מאמן חברותי", "set_personality_friendly_coach")],
          [Markup.button.callback("📊 תזונאי מקצועי", "set_personality_strict_nutritionist")],
          [Markup.button.callback("😄 חבר מצחיק", "set_personality_funny_friend")],
          [Markup.button.callback("⚡ ישיר וקצר", "set_personality_no_nonsense")],
          [Markup.button.callback("✏️ מותאם אישית", "set_personality_custom")],
        ]),
      }
    );
    return;
  }

  // Handle diet selection
  if (data.startsWith("set_diet_")) {
    const dietMap: Record<string, DietType> = {
      set_diet_caloric_balance: "caloric_balance",
      set_diet_keto: "keto",
      set_diet_intermittent_fasting: "intermittent_fasting",
      set_diet_plant_based: "plant_based",
      set_diet_high_protein: "high_protein",
      set_diet_custom: "custom",
    };

    const newDiet = dietMap[data];
    if (!newDiet) return;

    if (newDiet === "caloric_balance") {
      editingState.set(telegramId, { field: "calorie_goal", awaitingText: true });
      await ctx.reply("מה יעד הקלוריות היומי שלך? (ברירת מחדל: 2000)");
      return;
    } else if (newDiet === "intermittent_fasting") {
      editingState.set(telegramId, { field: "eating_window", awaitingText: true });
      updateUser(telegramId, { dietType: newDiet });
      await ctx.reply("מה חלון האכילה שלך? (למשל: 12:00–20:00)");
      return;
    } else if (newDiet === "custom") {
      editingState.set(telegramId, { field: "custom_rules", awaitingText: true });
      updateUser(telegramId, { dietType: newDiet });
      await ctx.reply("תאר את כללי הדיאטה שלך בחופשיות:");
      return;
    }

    updateUser(telegramId, { dietType: newDiet, customDietRules: undefined, calorieGoal: undefined });
    clearEditingState(telegramId);
    await ctx.reply(`✅ סוג הדיאטה עודכן ל-${formatDietLabel(newDiet)}`);
    return;
  }

  // Handle goal selection
  if (data.startsWith("set_goal_")) {
    const goalMap: Record<string, UserGoal> = {
      set_goal_lose_weight: "lose_weight",
      set_goal_build_muscle: "build_muscle",
      set_goal_maintain_weight: "maintain_weight",
      set_goal_eat_healthier: "eat_healthier",
      set_goal_more_energy: "more_energy",
    };

    const newGoal = goalMap[data];
    if (!newGoal) return;

    updateUser(telegramId, { goal: newGoal });
    clearEditingState(telegramId);
    await ctx.reply(`✅ המטרה עודכנה ל-${formatGoalLabel(newGoal)}`);
    return;
  }

  // Handle personality selection
  if (data.startsWith("set_personality_")) {
    const personalityMap: Record<string, BotPersonality> = {
      set_personality_friendly_coach: "friendly_coach",
      set_personality_strict_nutritionist: "strict_nutritionist",
      set_personality_funny_friend: "funny_friend",
      set_personality_no_nonsense: "no_nonsense",
      set_personality_custom: "custom",
    };

    const newPersonality = personalityMap[data];
    if (!newPersonality) return;

    if (newPersonality === "custom") {
      editingState.set(telegramId, { field: "custom_personality", awaitingText: true });
      await ctx.reply(
        "✏️ *סגנון מותאם אישית*\n\n" +
        "תאר בחופשיות איך תרצה שאדבר אליך.\n" +
        "לדוגמה: _\"מקצועי אבל עם הומור, תן לי נתונים מדויקים ואל תסביר יותר מדי\"_",
        { parse_mode: "Markdown" }
      );
      return;
    }

    updateUser(telegramId, { botPersonality: newPersonality, customPersonality: null });
    clearEditingState(telegramId);
    await ctx.reply(`✅ סגנון הבוט עודכן ל-${formatPersonalityLabel(newPersonality)}`);
    return;
  }
}

export async function handleSettingsTextInput(
  ctx: Context,
  text: string,
  telegramId: number
): Promise<boolean> {
  const state = editingState.get(telegramId);
  if (!state || !state.awaitingText) return false;

  if (state.field === "name") {
    const trimmed = text.trim();
    if (!trimmed) {
      await ctx.reply("אנא הכנס שם תקין.");
      return true;
    }
    updateUser(telegramId, { name: trimmed });
    clearEditingState(telegramId);
    await ctx.reply(`✅ השם עודכן ל-${trimmed}`);
    return true;
  }

  if (state.field === "calorie_goal") {
    const calories = parseInt(text.trim(), 10);
    if (isNaN(calories) || calories < 500 || calories > 10000) {
      await ctx.reply("אנא הכנס מספר קלוריות תקין (למשל: 2000)");
      return true;
    }
    updateUser(telegramId, { dietType: "caloric_balance", calorieGoal: calories });
    clearEditingState(telegramId);
    await ctx.reply(`✅ יעד הקלוריות עודכן ל-${calories} קק״ל`);
    return true;
  }

  if (state.field === "eating_window") {
    const trimmed = text.trim();
    updateUser(telegramId, { customDietRules: trimmed });
    clearEditingState(telegramId);
    await ctx.reply(`✅ חלון האכילה עודכן ל-${trimmed}`);
    return true;
  }

  if (state.field === "custom_rules") {
    const trimmed = text.trim();
    updateUser(telegramId, { customDietRules: trimmed });
    clearEditingState(telegramId);
    await ctx.reply(`✅ כללי הדיאטה עודכנו.`);
    return true;
  }

  if (state.field === "custom_personality") {
    const trimmed = text.trim();
    if (!trimmed) {
      await ctx.reply("אנא תאר את הסגנון הרצוי.");
      return true;
    }
    updateUser(telegramId, { botPersonality: "custom", customPersonality: trimmed });
    clearEditingState(telegramId);
    await ctx.reply(`✅ סגנון מותאם אישית נשמר: _${trimmed}_`, { parse_mode: "Markdown" });
    return true;
  }

  return false;
}

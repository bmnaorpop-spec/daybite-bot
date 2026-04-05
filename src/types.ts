export type DietType =
  | "caloric_balance"
  | "keto"
  | "intermittent_fasting"
  | "plant_based"
  | "high_protein"
  | "custom";

export type UserGoal =
  | "lose_weight"
  | "build_muscle"
  | "maintain_weight"
  | "eat_healthier"
  | "more_energy";

export type BotPersonality =
  | "friendly_coach"
  | "strict_nutritionist"
  | "funny_friend"
  | "no_nonsense"
  | "custom";

export interface MealEntry {
  description: string;
  timeOfDay: "בוקר" | "צהריים" | "ערב" | "נשנוש";
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes?: string;
  loggedAt: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface UserProfile {
  telegramId: number;
  name: string;
  dietType: DietType;
  calorieGoal?: number;
  customDietRules?: string;
  goal: UserGoal;
  botPersonality: BotPersonality;
  customPersonality?: string | null;
  currentDayLog: MealEntry[];
  lastLogDate: string;
  conversationHistory: Message[];
  createdAt: string;
}

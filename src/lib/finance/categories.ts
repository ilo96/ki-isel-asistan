/*
 * Varsayılan kategoriler ve görünümleri. İkon ve renk veritabanında ad olarak durur
 * (ör. "shopping-cart", "cat-2"); ekranda neye karşılık geldiğine burada karar verilir.
 */

export const CATEGORY_COLORS = [
  "cat-1",
  "cat-2",
  "cat-3",
  "cat-4",
  "cat-5",
  "cat-6",
  "cat-7",
  "cat-8",
] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export const CATEGORY_ICONS = [
  "shopping-cart",
  "utensils",
  "bus",
  "home",
  "receipt",
  "heart-pulse",
  "ticket",
  "shopping-bag",
  "briefcase",
  "circle-plus",
  "ellipsis",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export type DefaultCategory = {
  systemKey: string;
  type: "income" | "expense";
  name: string;
  icon: CategoryIcon;
  colorToken: CategoryColor;
};

/** Plan: kayıtta 11 varsayılan kategori kullanıcıya kopyalanır. */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  {
    systemKey: "groceries",
    type: "expense",
    name: "Market",
    icon: "shopping-cart",
    colorToken: "cat-2",
  },
  { systemKey: "food", type: "expense", name: "Yemek", icon: "utensils", colorToken: "cat-3" },
  { systemKey: "transport", type: "expense", name: "Ulaşım", icon: "bus", colorToken: "cat-4" },
  { systemKey: "rent", type: "expense", name: "Kira", icon: "home", colorToken: "cat-1" },
  { systemKey: "bills", type: "expense", name: "Faturalar", icon: "receipt", colorToken: "cat-6" },
  {
    systemKey: "health",
    type: "expense",
    name: "Sağlık",
    icon: "heart-pulse",
    colorToken: "cat-5",
  },
  {
    systemKey: "entertainment",
    type: "expense",
    name: "Eğlence",
    icon: "ticket",
    colorToken: "cat-1",
  },
  {
    systemKey: "shopping",
    type: "expense",
    name: "Alışveriş",
    icon: "shopping-bag",
    colorToken: "cat-5",
  },
  {
    systemKey: "other_expense",
    type: "expense",
    name: "Diğer",
    icon: "ellipsis",
    colorToken: "cat-8",
  },
  { systemKey: "salary", type: "income", name: "Maaş", icon: "briefcase", colorToken: "cat-7" },
  {
    systemKey: "other_income",
    type: "income",
    name: "Diğer gelir",
    icon: "circle-plus",
    colorToken: "cat-7",
  },
];

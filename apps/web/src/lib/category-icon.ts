const ICON_GENERIC = "/assets/category-icons/generic.svg";

const CATEGORY_ICON_RULES: Array<{ match: RegExp; icon: string }> = [
  { match: /(подвеск|рулев)/i, icon: "/assets/category-icons/suspension.svg" },
  { match: /(тормоз)/i, icon: "/assets/category-icons/brakes.svg" },
  { match: /(двигател|зажиган)/i, icon: "/assets/category-icons/engine.svg" },
  { match: /(масл|жидк|то\b)/i, icon: "/assets/category-icons/to.svg" },
  { match: /(фильтр)/i, icon: "/assets/category-icons/filters.svg" },
  { match: /(электр|электрик)/i, icon: "/assets/category-icons/electrics.svg" },
  {
    match: /(охлажден|отоплен|радиатор)/i,
    icon: "/assets/category-icons/cooling.svg",
  },
  {
    match: /(расходник|хими|очист)/i,
    icon: "/assets/category-icons/consumables.svg",
  },
  { match: /(кузов|оптик|фара)/i, icon: "/assets/category-icons/body.svg" },
  { match: /(трансмис|кпп|сцеплен)/i, icon: "/assets/category-icons/gearbox.svg" },
  { match: /(проч|прочие|другое|разное)/i, icon: "/assets/category-icons/misc.svg" },
];

export function getCategoryIconPath(categoryName: string): string {
  const normalized = categoryName.trim();
  if (!normalized) return ICON_GENERIC;

  for (const rule of CATEGORY_ICON_RULES) {
    if (rule.match.test(normalized)) {
      return rule.icon;
    }
  }
  return ICON_GENERIC;
}


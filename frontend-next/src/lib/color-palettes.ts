export type ColorPalette = {
  id: string;
  name: string;
  description: string;
  values: string[];
  preview: {
    primary: string;
    secondary: string;
    accent: string;
  };
};

export const colorPalettes: ColorPalette[] = [
  {
    id: 'aero-silver',
    name: 'الأزرق الفاتح والسلفر المطفي',
    description: 'أزرق هادئ مع فضي مطفي يمنح الثقة والموثوقية بطابع مؤسسي فاخر',
    values: ['الثقة', 'الموثوقية', 'الصلابة', 'الفخامة'],
    preview: {
      primary: 'linear-gradient(145deg, #1f3a5f 0%, #274d7c 45%, #1e293b 100%)',
      secondary: 'linear-gradient(145deg, #cbd5e1 0%, #94a3b8 55%, #64748b 100%)',
      accent: 'linear-gradient(145deg, #60a5fa 0%, #3b82f6 100%)',
    },
  },
  {
    id: 'dark-emerald',
    name: 'الزمرد الداكن',
    description: 'الأخضر الزمردي مع الذهب - يرمز للنمو المستدام والثروة',
    values: ['الاستقرار', 'النمو', 'الثروة', 'الأمان'],
    preview: {
      primary: 'linear-gradient(145deg, #022c22 0%, #0f172a 45%, #111827 100%)',
      secondary: 'linear-gradient(145deg, #f59e0b 0%, #ca8a04 50%, #a16207 100%)',
      accent: 'linear-gradient(145deg, #047857 0%, #064e3b 100%)',
    },
  },
  {
    id: 'royal-granite',
    name: 'الجرانيت الملكي',
    description: 'الرمادي الداكن مع الذهب الكلاسيكي - قمة الصلابة والفخامة معاً',
    values: ['الصلابة', 'الثبات', 'الفخامة', 'الأصالة'],
    preview: {
      primary: 'linear-gradient(145deg, #030712 0%, #0f172a 45%, #09090b 100%)',
      secondary: 'linear-gradient(145deg, #ca8a04 0%, #f59e0b 55%, #a16207 100%)',
      accent: 'linear-gradient(145deg, #1f2937 0%, #030712 100%)',
    },
  },
];

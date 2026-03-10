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
];

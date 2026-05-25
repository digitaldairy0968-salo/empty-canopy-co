import {
  FileBarChart,
  History,
  IdCard,
  TrendingUp,
  LogIn,
  Package,
  Users,
  Users2,
  UsersRound,
  Edit3,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface FeatureDef {
  key: string;
  labelHi: string;
  labelEn: string;
  icon: LucideIcon;
  color: string; // tailwind gradient classes
}

export const FEATURE_CATALOG: FeatureDef[] = [
  { key: 'monthly_report', labelHi: 'मासिक रिपोर्ट', labelEn: 'Monthly Report', icon: FileBarChart, color: 'from-blue-500 to-cyan-500' },
  { key: 'supplier_history', labelHi: 'सप्लायर हिस्ट्री', labelEn: 'Supplier History', icon: History, color: 'from-purple-500 to-pink-500' },
  { key: 'supplier_card', labelHi: 'सप्लायर कार्ड', labelEn: 'Supplier Card', icon: IdCard, color: 'from-emerald-500 to-teal-500' },
  { key: 'profit_report', labelHi: 'प्रॉफिट रिपोर्ट', labelEn: 'Profit Report', icon: TrendingUp, color: 'from-amber-500 to-orange-500' },
  { key: 'supplier_login', labelHi: 'सप्लायर लॉगिन सक्षम', labelEn: 'Enable Supplier Login', icon: LogIn, color: 'from-indigo-500 to-violet-500' },
  { key: 'everything_basic', labelHi: 'बेसिक प्लान के सभी फीचर्स', labelEn: 'Everything in Basic Plan', icon: Package, color: 'from-slate-500 to-gray-600' },
  { key: 'suppliers_50', labelHi: '50 सप्लायर', labelEn: '50 Suppliers', icon: Users, color: 'from-green-500 to-emerald-500' },
  { key: 'suppliers_100', labelHi: '100 सप्लायर', labelEn: '100 Suppliers', icon: Users2, color: 'from-lime-500 to-green-600' },
  { key: 'suppliers_unlimited', labelHi: 'असीमित सप्लायर', labelEn: 'Unlimited Suppliers', icon: UsersRound, color: 'from-fuchsia-500 to-purple-600' },
  { key: 'code_change_after_entry', labelHi: 'एंट्री के बाद कोड बदलाव', labelEn: 'Code Change After Entry', icon: Edit3, color: 'from-rose-500 to-red-500' },
  { key: 'milk_predict', labelHi: 'दूध भविष्यवाणी', labelEn: 'Milk Predict', icon: Sparkles, color: 'from-yellow-500 to-amber-500' },
];

export const getFeatureDef = (keyOrLabel: string): FeatureDef | null => {
  const found = FEATURE_CATALOG.find(
    f => f.key === keyOrLabel || f.labelHi === keyOrLabel || f.labelEn === keyOrLabel
  );
  return found || null;
};

export const getFeatureLabel = (keyOrLabel: string, lang: string): string => {
  const def = getFeatureDef(keyOrLabel);
  if (!def) return keyOrLabel;
  return lang === 'hi' ? def.labelHi : def.labelEn;
};

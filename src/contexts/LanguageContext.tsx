import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'hi' | 'gu' | 'en';

interface Translations {
  [key: string]: {
    hi: string;
    gu: string;
    en: string;
  };
}

const translations: Translations = {
  // Common
  appName: { hi: 'डेयरी प्रबंधक', gu: 'ડેરી મેનેજર', en: 'Dairy Manager' },
  login: { hi: 'लॉगिन', gu: 'લોગિન', en: 'Login' },
  signup: { hi: 'साइन अप', gu: 'સાઇન અપ', en: 'Sign Up' },
  logout: { hi: 'लॉगआउट', gu: 'લોગઆઉટ', en: 'Logout' },
  owner: { hi: 'मालिक', gu: 'માલિક', en: 'Owner' },
  supplier: { hi: 'सप्लायर', gu: 'સપ્લાયર', en: 'Supplier' },
  phone: { hi: 'फोन नंबर', gu: 'ફોન નંબર', en: 'Phone Number' },
  password: { hi: 'पासवर्ड', gu: 'પાસવર્ડ', en: 'Password' },
  name: { hi: 'नाम', gu: 'નામ', en: 'Name' },
  
  // Dashboard
  dashboard: { hi: 'डैशबोर्ड', gu: 'ડેશબોર્ડ', en: 'Dashboard' },
  totalSuppliers: { hi: 'कुल सप्लायर', gu: 'કુલ સપ્લાયર', en: 'Total Suppliers' },
  todayMilk: { hi: 'आज का दूध', gu: 'આજનું દૂધ', en: "Today's Milk" },
  totalMilk: { hi: 'कुल दूध', gu: 'કુલ દૂધ', en: 'Total Milk' },
  totalFat: { hi: 'कुल फैट', gu: 'કુલ ફેટ', en: 'Total Fat' },
  liters: { hi: 'लीटर', gu: 'લિટર', en: 'Liters' },
  
  // Milk Entry
  morning: { hi: 'सुबह', gu: 'સવાર', en: 'Morning' },
  evening: { hi: 'शाम', gu: 'સાંજ', en: 'Evening' },
  milk: { hi: 'दूध', gu: 'દૂધ', en: 'Milk' },
  fat: { hi: 'फैट', gu: 'ફેટ', en: 'Fat' },
  snf: { hi: 'SNF', gu: 'SNF', en: 'SNF' },
  lr: { hi: 'LR', gu: 'LR', en: 'LR' },
  quantity: { hi: 'मात्रा', gu: 'જથ્થો', en: 'Quantity' },
  date: { hi: 'तारीख', gu: 'તારીખ', en: 'Date' },
  save: { hi: 'सेव करें', gu: 'સાચવો', en: 'Save' },
  cancel: { hi: 'रद्द करें', gu: 'રદ કરો', en: 'Cancel' },
  
  // Supplier
  addSupplier: { hi: 'सप्लायर जोड़ें', gu: 'સપ્લાયર ઉમેરો', en: 'Add Supplier' },
  supplierList: { hi: 'सप्लायर सूची', gu: 'સપ્લાયર યાદી', en: 'Supplier List' },
  supplierCard: { hi: 'सप्लायर कार्ड', gu: 'સપ્લાયર કાર્ડ', en: 'Supplier Card' },
  animalType: { hi: 'पशु का प्रकार', gu: 'પ્રાણીનો પ્રકાર', en: 'Animal Type' },
  cow: { hi: 'गाय', gu: 'ગાય', en: 'Cow' },
  buffalo: { hi: 'भैंस', gu: 'ભેંસ', en: 'Buffalo' },
  goat: { hi: 'बकरी', gu: 'બકરી', en: 'Goat' },
  villageName: { hi: 'गाँव का नाम', gu: 'ગામનું નામ', en: 'Village Name' },
  
  // Reports
  reports: { hi: 'रिपोर्ट', gu: 'રિપોર્ટ', en: 'Reports' },
  daily: { hi: 'दैनिक', gu: 'દૈનિક', en: 'Daily' },
  weekly: { hi: 'साप्ताहिक', gu: 'સાપ્તાહિક', en: 'Weekly' },
  monthly: { hi: 'मासिक', gu: 'માસિક', en: 'Monthly' },
  last10Days: { hi: 'पिछले 10 दिन', gu: 'છેલ્લા 10 દિવસ', en: 'Last 10 Days' },
  last11Days: { hi: 'पिछले 11 दिन', gu: 'છેલ્લા 11 દિવસ', en: 'Last 11 Days' },
  last30Days: { hi: 'पिछले 30 दिन', gu: 'છેલ્લા 30 દિવસ', en: 'Last 30 Days' },
  total: { hi: 'कुल', gu: 'કુલ', en: 'Total' },
  totalAmount: { hi: 'कुल राशि', gu: 'કુલ રકમ', en: 'Total Amount' },
  avgFat: { hi: 'औसत फैट', gu: 'સરેરાશ ફેટ', en: 'Avg Fat' },
  
  // Calculator
  calculator: { hi: 'कैलकुलेटर', gu: 'કેલ્ક્યુલેટર', en: 'Calculator' },
  
  // Settings
  settings: { hi: 'सेटिंग्स', gu: 'સેટિંગ્સ', en: 'Settings' },
  language: { hi: 'भाषा', gu: 'ભાષા', en: 'Language' },
  rateSettings: { hi: 'रेट सेटिंग्स', gu: 'રેટ સેટિંગ્સ', en: 'Rate Settings' },
  fatRate: { hi: 'फैट रेट', gu: 'ફેટ રેટ', en: 'Fat Rate' },
  perLiter: { hi: 'प्रति लीटर', gu: 'પ્રતિ લિટર', en: 'Per Liter' },
  
  // Messages
  welcome: { hi: 'स्वागत है', gu: 'સ્વાગત છે', en: 'Welcome' },
  noData: { hi: 'कोई डेटा नहीं', gu: 'કોઈ ડેટા નથી', en: 'No Data' },
  success: { hi: 'सफल', gu: 'સફળ', en: 'Success' },
  error: { hi: 'त्रुटि', gu: 'ભૂલ', en: 'Error' },
  confirm: { hi: 'पुष्टि करें', gu: 'પુષ્ટિ કરો', en: 'Confirm' },
  
  // Navigation
  home: { hi: 'होम', gu: 'હોમ', en: 'Home' },
  profile: { hi: 'प्रोफाइल', gu: 'પ્રોફાઇલ', en: 'Profile' },
  
  // Entry specific
  enterMilk: { hi: 'दूध दर्ज करें', gu: 'દૂધ દાખલ કરો', en: 'Enter Milk' },
  optional: { hi: 'वैकल्पिक', gu: 'વૈકલ્પિક', en: 'Optional' },
  withoutFat: { hi: 'बिना फैट के', gu: 'ફેટ વિના', en: 'Without Fat' },
  
  // Announcements
  announcements: { hi: 'घोषणाएं', gu: 'જાહેરાતો', en: 'Announcements' },
  viewCard: { hi: 'कार्ड देखें', gu: 'કાર્ડ જુઓ', en: 'View Card' },
  
  // Voice
  voiceEntry: { hi: 'आवाज से दर्ज करें', gu: 'અવાજથી દાખલ કરો', en: 'Voice Entry' },
  listening: { hi: 'सुन रहा हूं...', gu: 'સાંભળી રહ્યો છું...', en: 'Listening...' },
  speak: { hi: 'बोलें', gu: 'બોલો', en: 'Speak' },
  
  // Print Receipt
  printReceipt: { hi: 'रसीद प्रिंट करें', gu: 'રસીદ છાપો', en: 'Print Receipt' },
  milkReceipt: { hi: 'दूध रसीद', gu: 'દૂધ રસીદ', en: 'Milk Receipt' },
  paymentMode: { hi: 'भुगतान मोड', gu: 'ચૂકવણી મોડ', en: 'Payment Mode' },
  cash: { hi: 'नकद', gu: 'રોકડ', en: 'Cash' },
  bankTransfer: { hi: 'बैंक ट्रांसफर', gu: 'બેંક ટ્રાન્સફર', en: 'Bank Transfer' },
  producerId: { hi: 'उत्पादक आईडी', gu: 'ઉત્પાદક ID', en: 'Producer ID' },
  milkType: { hi: 'दूध प्रकार', gu: 'દૂધ પ્રકાર', en: 'Milk Type' },
  ratePerUnit: { hi: 'प्रति इकाई दर', gu: 'પ્રતિ એકમ દર', en: 'Rate per Unit' },
  
  // Custom Date Range
  customDateRange: { hi: 'कस्टम तारीख रेंज', gu: 'કસ્ટમ તારીખ શ્રેણી', en: 'Custom Date Range' },
  fromDate: { hi: 'से', gu: 'થી', en: 'From' },
  toDate: { hi: 'तक', gu: 'સુધી', en: 'To' },
  both: { hi: 'दोनों', gu: 'બંને', en: 'Both' },
  selectDate: { hi: 'तारीख चुनें', gu: 'તારીખ પસંદ કરો', en: 'Select Date' },
  filter: { hi: 'फ़िल्टर', gu: 'ફિલ્ટર', en: 'Filter' },
  
  // Milk Entry
  milkEntry: { hi: 'दूध एंट्री', gu: 'દૂધ એન્ટ્રી', en: 'Milk Entry' },
  supplierCode: { hi: 'सप्लायर कोड', gu: 'સપ્લાયર કોડ', en: 'Supplier Code' },
  selectSupplier: { hi: 'सप्लायर चुनें', gu: 'સપ્લાયર પસંદ કરો', en: 'Select Supplier' },
  shift: { hi: 'शिफ्ट', gu: 'શિફ્ટ', en: 'Shift' },
  saveEntry: { hi: 'एंट्री सेव करें', gu: 'એન્ટ્રી સાચવો', en: 'Save Entry' },
  calculation: { hi: 'हिसाब', gu: 'હિસાબ', en: 'Calculation' },
  report: { hi: 'रिपोर्ट', gu: 'રિપોર્ટ', en: 'Report' },
  entries: { hi: 'एंट्री', gu: 'એન્ટ્રી', en: 'Entries' },
  generateReceipt: { hi: 'रसीद बनाएं', gu: 'રસીદ બનાવો', en: 'Generate Receipt' },
  customer: { hi: 'ग्राहक', gu: 'ગ્રાહક', en: 'Customer' },
  dairySettings: { hi: 'डेयरी सेटिंग्स', gu: 'ડેરી સેટિંગ્સ', en: 'Dairy Settings' },
  dairyName: { hi: 'डेयरी का नाम', gu: 'ડેરીનું નામ', en: 'Dairy Name' },
  dairyCode: { hi: 'डेयरी कोड', gu: 'ડેરી કોડ', en: 'Dairy Code' },
  showCalculations: { hi: 'ग्राहकों को हिसाब दिखाएं', gu: 'ગ્રાહકોને હિસાબ બતાવો', en: 'Show Calculations to Customers' },
  morningMilk: { hi: 'सुबह का दूध', gu: 'સવારનું દૂધ', en: 'Morning Milk' },
  eveningMilk: { hi: 'शाम का दूध', gu: 'સાંજનું દૂધ', en: 'Evening Milk' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('dairy-language');
    return (saved as Language) || 'hi';
  });

  useEffect(() => {
    localStorage.setItem('dairy-language', language);
  }, [language]);

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

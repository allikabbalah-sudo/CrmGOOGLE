import React from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Calendar,
  Database,
  Mail,
  FileText,
  UserCheck,
  CheckCircle,
} from 'lucide-react';

interface PrivacyViewProps {
  onNavigate: (path: string) => void;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground flex flex-col justify-between font-heebo dir-rtl selection:bg-teal-500/20 selection:text-teal-700">
      {/* Header */}
      <header className="w-full border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('/')}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <ArrowRight className="w-4 h-4" />
              <span>חזרה לדף הבית</span>
            </button>
            <span className="text-border">|</span>
            <span className="font-extrabold text-base tracking-tight text-foreground">
              crmkabbalah
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('/')}
              className="px-3.5 py-1.5 bg-card hover:bg-muted text-foreground border border-border text-xs font-bold rounded-xl transition-colors"
            >
              עמוד ראשי
            </button>
            <button
              onClick={() => onNavigate('/auth')}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors"
            >
              התחברות
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">
        <div className="border-b border-border pb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>מסמך משפטי רשמי</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground">
            מדיניות פרטיות — crmkabbalah
          </h1>
          <p className="text-xs text-muted-foreground">
            עודכן לאחרונה: {new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Introduction */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-2xs space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            1. מבוא ומהות השירות
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ברוכים הבאים לאפליקציית <strong>crmkabbalah</strong> ("המערכת", "האפליקציה").
            מערכת <strong>crmkabbalah</strong> הינה פלטפורמה לניהול קשרי לקוחות (CRM), מעקב מפגשים וסנכרון יומן פגישות עבור מטפלים וקליניקות.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            אנו מחויבים להגנה מלאה על פרטיות המשתמשים שלנו, על המידע האישי שלהם ועל המידע הנוגע למטופלים שלהם. מדיניות פרטיות זו מפרטת איזה מידע נאסף, כיצד נעשה בו שימוש, כיצד הוא מאובטח, ואת זכויותיך ביחס למידע זה.
          </p>
        </section>

        {/* Information Collected */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-2xs space-y-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-teal-600" />
            2. המידע שאנו אוספים
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              אנו אוספים מידע אך ורק לצורך תפעול תקין של שירותי הקליניקה והמערכת:
            </p>
            <ul className="list-disc list-inside space-y-1.5 mr-2">
              <li>
                <strong>פרטי משתמש / מטפל:</strong> כתובת דוא"ל, שם מלא ופרטי ארגון/קליניקה לצורך הזדהות ואבטחת החשבון.
              </li>
              <li>
                <strong>פרטי ניהול לקוחות ומפגשים:</strong> שמות לקוחות, פרטי יצירת קשר (טלפון, דוא"ל), תאריכי מפגשים, משימות לביצוע ותיעוד טיפולי המוזן באופן ישיר על ידי המטפל.
              </li>
              <li>
                <strong>נתוני חיבור וסנכרון Google:</strong> כאשר המשתמש בוחר לחבר את חשבון ה-Google שלו, אנו מקבלים מזהה משתמש בסיסי ואישור גישה ליומן Google Calendar.
              </li>
            </ul>
          </div>
        </section>

        {/* Google User Data & Calendar Disclosure (Critical for OAuth) */}
        <section className="bg-card border-2 border-teal-500/40 rounded-2xl p-6 shadow-xs space-y-4 bg-teal-500/5">
          <div className="flex items-center gap-2.5 text-teal-800 dark:text-teal-200">
            <Calendar className="w-6 h-6 text-teal-600" />
            <h2 className="text-lg font-black">
              3. שימוש במידע מתוך שירותי Google (Google Calendar API & OAuth)
            </h2>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              אפליקציית <strong>crmkabbalah</strong> מאפשרת למשתמש לסנכרן פגישות ולוחות זמנים עם יומן Google Calendar האישי שלו.
            </p>
            
            <div className="p-4 bg-card rounded-xl border border-border space-y-2">
              <h3 className="font-bold text-foreground text-xs sm:text-sm">
                כיצד אנו משתמשים בהרשאות יומן Google (Google Calendar Scopes):
              </h3>
              <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground mr-2">
                <li>
                  <strong>קריאת אירועים (Read Events):</strong> הצגת פגישות קיימות ביומן האפליקציה למניעת התנגשויות זמנים.
                </li>
                <li>
                  <strong>יצירה ועדכון אירועים (Write/Manage Events):</strong> הוספת פגישות טיפוליות חדשות ועדכון מועדי מפגשים ישירות ביומן Google של המטפל.
                </li>
              </ul>
            </div>

            <div className="p-4 bg-teal-600/10 border border-teal-600/20 rounded-xl space-y-2">
              <h3 className="font-bold text-teal-900 dark:text-teal-200 text-xs sm:text-sm flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-teal-600" />
                הצהרת עמידה בתקנות Google API (Limited Use Policy):
              </h3>
              <p className="text-xs text-teal-800 dark:text-teal-300 leading-relaxed font-mono">
                "crmkabbalah's use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-bold text-teal-700 dark:text-teal-200 hover:text-teal-950"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements."
              </p>
            </div>

            <ul className="list-disc list-inside space-y-1 mr-2 text-xs">
              <li>איננו מוכרים, משכירים או מעבירים מידע מ-Google לצדדים שלישיים או למטרות פרסום.</li>
              <li>איננו משתמשים במידע מ-Google Calendar לצורך אימון מודלי בינה מלאכותית כלליים.</li>
              <li>המשתמש יכול לנתק את החיבור ל-Google בכל עת במסך ההגדרות במערכת בלחיצת כפתור אחת.</li>
            </ul>
          </div>
        </section>

        {/* Data Storage & Security */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-2xs space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Database className="w-5 h-5 text-teal-600" />
            4. אחסון המידע ואבטחתו
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            נתוני המערכת מאוחסנים במסד הנתונים בענן <strong>Firebase Firestore</strong> (של Google Cloud), תוך שימוש בתקני אבטחה מחמירים, הצפנת נתונים בתעבורה (SSL/TLS) וכללי אבטחה ברמת המסמך (Firestore Security Rules) המבטיחים כי רק המשתמש המורשה יכול לגשת לנתוניו.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            נתונים רגישים הנוגעים לקבצים והקלטות מאוחסנים מקומית במכשיר המשתמש או באופן מוצפן בענן בנפחים מבוקרים.
          </p>
        </section>

        {/* User Rights & Data Deletion */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-2xs space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Lock className="w-5 h-5 text-teal-600" />
            5. זכויות המשתמש, ייצוא ומחיקת מידע
          </h2>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>לכל משתמש במערכת עומדות הזכויות המלאות על נתוניו:</p>
            <ul className="list-disc list-inside space-y-1.5 mr-2">
              <li>
                <strong>ייצוא נתונים מלא (Export):</strong> ניתן בכל עת לייצא את כל נתוני המערכת, הלקוחות, המפגשים והמדיה כקובץ ארכיון (ZIP) ישירות מעמוד ההגדרות.
              </li>
              <li>
                <strong>מחיקת מידע (Deletion):</strong> המשתמש רשאי למחוק לקוחות, מפגשים או את כלל הנתונים ישירות מהממשק, או לפנות אלינו בבקשה למחיקת החשבון וכל המידע המשויך אליו בענן.
              </li>
              <li>
                <strong>ביטול הרשאות:</strong> ניתן לנתק את סנכרון יומן Google בכל עת מתוך המערכת או ישירות מעמוד ניהול הרשאות חשבון Google של המשתמש.
              </li>
            </ul>
          </div>
        </section>

        {/* Contact Us */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-2xs space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Mail className="w-5 h-5 text-teal-600" />
            6. יצירת קשר בנושאי פרטיות
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            בכל שאלה, הבהרה או בקשה בנוגע למדיניות פרטיות זו או לניהול המידע האישי שלך באפליקציית <strong>crmkabbalah</strong>, ניתן לפנות אלינו ישירות:
          </p>
          <div className="p-4 bg-muted/50 rounded-xl text-xs space-y-1 text-foreground">
            <div><strong>מערכת:</strong> crmkabbalah</div>
            <div>
              <strong>דוא"ל מנהל המערכת:</strong>{' '}
              <a
                href="mailto:alli.kabbalah@gmail.com"
                className="text-primary hover:underline font-bold"
              >
                alli.kabbalah@gmail.com
              </a>
            </div>
            <div><strong>מענה:</strong> תוך ימי עסקים ספורים לכל פנייה בנושא פרטיות ואבטחת נתונים.</div>
          </div>
        </section>

        {/* Back button at bottom */}
        <div className="text-center pt-4">
          <button
            onClick={() => onNavigate('/')}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors inline-flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            <span>חזרה לעמוד הראשי (crmkabbalah)</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border bg-card/60 py-6 text-xs text-muted-foreground mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            crmkabbalah © {new Date().getFullYear()} • כל הזכויות שמורות
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => onNavigate('/')} className="hover:text-foreground">
              עמוד ראשי
            </button>
            <button onClick={() => onNavigate('/auth')} className="hover:text-foreground">
              התחברות
            </button>
            <a href="mailto:alli.kabbalah@gmail.com" className="hover:text-foreground">
              צור קשר
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

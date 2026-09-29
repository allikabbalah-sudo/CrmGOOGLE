import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, MapPin, Calendar as CalendarIcon, Heart, BookOpen, FileText, Camera, Upload, Trash2 } from 'lucide-react';
import { Client, ClientStatus, KABBALAH_READINGS } from '../../types';
import { useOrganization } from '../../context/OrganizationContext';
import { cleanEmail } from '../../lib/utils';
import { compressImageFile } from '../../lib/indexedDbStorage';
import { ClientAvatar } from '../common/ClientAvatar';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Partial<Client>) => void;
  clientToEdit?: Client | null;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clientToEdit,
}) => {
  const { members } = useOrganization();

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<ClientStatus>('lead');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [motherName, setMotherName] = useState('');
  const [address, setAddress] = useState('');
  const [selectedReading, setSelectedReading] = useState<string>('');
  const [partnerFullName, setPartnerFullName] = useState('');
  const [partnerDob, setPartnerDob] = useState('');
  const [partnerMotherName, setPartnerMotherName] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  useEffect(() => {
    if (clientToEdit) {
      setFullName(clientToEdit.full_name || '');
      setAvatarUrl(clientToEdit.avatar_url || '');
      setPhone(clientToEdit.phone || '');
      setEmail(clientToEdit.email || '');
      setStatus(clientToEdit.status || 'lead');
      setDateOfBirth(clientToEdit.date_of_birth || '');
      setMotherName(clientToEdit.mother_name || '');
      setAddress(clientToEdit.address || '');
      setSelectedReading(clientToEdit.selected_reading || '');
      setPartnerFullName(clientToEdit.partner_full_name || '');
      setPartnerDob(clientToEdit.partner_dob || '');
      setPartnerMotherName(clientToEdit.partner_mother_name || '');
      setNotes(clientToEdit.notes || '');
      setAssignedTo(clientToEdit.assigned_to || '');
    } else {
      setFullName('');
      setAvatarUrl('');
      setPhone('');
      setEmail('');
      setStatus('lead');
      setDateOfBirth('');
      setMotherName('');
      setAddress('');
      setSelectedReading('');
      setPartnerFullName('');
      setPartnerDob('');
      setPartnerMotherName('');
      setNotes('');
      setAssignedTo(members[0]?.user_id || '');
    }
  }, [clientToEdit, isOpen, members]);

  if (!isOpen) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 250, 250, 0.82);
      if (compressed) {
        setAvatarUrl(compressed);
      }
    } catch (err) {
      console.error('Failed to compress avatar:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    onSave({
      full_name: fullName.trim(),
      avatar_url: avatarUrl || undefined,
      phone: phone.trim(),
      email: cleanEmail(email),
      status,
      date_of_birth: dateOfBirth || undefined,
      mother_name: motherName.trim() || undefined,
      address: address.trim() || undefined,
      selected_reading: selectedReading || undefined,
      partner_full_name: partnerFullName.trim() || undefined,
      partner_dob: partnerDob || undefined,
      partner_mother_name: partnerMotherName.trim() || undefined,
      notes: notes.trim() || undefined,
      assigned_to: assignedTo || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {clientToEdit ? 'עריכת פרטי לקוח/מטופל' : 'הוספת לקוח/מטופל חדש לקליניקה'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 text-right">
          {/* General Information */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-primary tracking-wide uppercase border-b border-border pb-1">
              פרטי זיהוי קליניים
            </h4>

            {/* Avatar Section */}
            <div className="p-3.5 bg-muted/30 border border-border/80 rounded-2xl space-y-3">
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                  <ClientAvatar
                    avatarUrl={avatarUrl}
                    name={fullName}
                    className="w-16 h-16 border-2 border-primary/40 shadow-sm"
                  />
                  <label
                    htmlFor="avatar-file-modal"
                    className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"
                    title="החלף תמונה"
                  >
                    <Camera className="w-5 h-5" />
                  </label>
                </div>

                <div className="flex-1 space-y-1 text-xs">
                  <span className="font-semibold text-foreground block">תמונת פרופיל / אווטר ללקוח</span>
                  <p className="text-[11px] text-muted-foreground">
                    התמונה תוצג בכרטיס המטופל, ברשימת הלקוחות, ביומן המפגשים ובדשבורד
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label
                      htmlFor="avatar-file-modal"
                      className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{avatarUrl ? 'החלף מהמכשיר' : 'העלה תמונה מהמכשיר'}</span>
                    </label>
                    <input
                      id="avatar-file-modal"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                    />
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-500/10 border border-rose-300 dark:border-rose-800 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>הסר תמונה</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Preset Spiritual Avatars */}
              <div className="pt-2 border-t border-border/50">
                <span className="text-[11px] text-muted-foreground font-medium block mb-2">
                  או בחר אווטר קבלי / אנרגטי מוכן:
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    {
                      id: 'tree',
                      label: 'עץ החיים',
                      svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230d9488"/><stop offset="100%" stop-color="%23042f2e"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23g)"/><circle cx="50" cy="20" r="7" fill="%23fef08a"/><circle cx="30" cy="35" r="6" fill="%23bae6fd"/><circle cx="70" cy="35" r="6" fill="%23fbcfe8"/><circle cx="30" cy="65" r="6" fill="%23fed7aa"/><circle cx="70" cy="65" r="6" fill="%23bbf7d0"/><circle cx="50" cy="50" r="7" fill="%23fde047"/><circle cx="50" cy="80" r="8" fill="%23ffffff"/><line x1="50" y1="20" x2="30" y2="35" stroke="%23ffffff" stroke-width="2" opacity="0.6"/><line x1="50" y1="20" x2="70" y2="35" stroke="%23ffffff" stroke-width="2" opacity="0.6"/><line x1="30" y1="35" x2="70" y2="35" stroke="%23ffffff" stroke-width="2" opacity="0.6"/><line x1="30" y1="35" x2="50" y2="50" stroke="%23ffffff" stroke-width="2" opacity="0.6"/><line x1="70" y1="35" x2="50" y2="50" stroke="%23ffffff" stroke-width="2" opacity="0.6"/><line x1="50" y1="50" x2="50" y2="80" stroke="%23ffffff" stroke-width="2" opacity="0.6"/></svg>'
                    },
                    {
                      id: 'soul',
                      label: 'אור ונשמה',
                      svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%236366f1"/><stop offset="100%" stop-color="%239333ea"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23bg)"/><circle cx="50" cy="50" r="26" fill="%23ffffff" opacity="0.25"/><circle cx="50" cy="50" r="16" fill="%23ffffff" opacity="0.45"/><circle cx="50" cy="50" r="8" fill="%23fef08a"/><path d="M50 15 L50 25 M50 75 L50 85 M15 50 L25 50 M75 50 L85 50" stroke="%23fef08a" stroke-width="3" stroke-linecap="round"/></svg>'
                    },
                    {
                      id: 'lotus',
                      label: 'ריפוי וצמיחה',
                      svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23059669"/><stop offset="100%" stop-color="%23047857"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23bg)"/><circle cx="50" cy="50" r="24" fill="%23ecfdf5" opacity="0.3"/><path d="M50 25 C45 40 30 50 30 65 C30 75 40 80 50 80 C60 80 70 75 70 65 C70 50 55 40 50 25 Z" fill="%23a7f3d0"/></svg>'
                    },
                    {
                      id: 'shield',
                      label: 'מגן קבלי',
                      svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23d97706"/><stop offset="100%" stop-color="%23b45309"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23bg)"/><polygon points="50,22 76,68 24,68" stroke="%23fef3c7" stroke-width="3.5" fill="none"/><polygon points="50,78 76,32 24,32" stroke="%23fef3c7" stroke-width="3.5" fill="none"/><circle cx="50" cy="50" r="6" fill="%23fde68a"/></svg>'
                    },
                    {
                      id: 'blue',
                      label: 'שלווה',
                      svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230284c7"/><stop offset="100%" stop-color="%231e40af"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23bg)"/><circle cx="50" cy="38" r="16" fill="%23e0f2fe"/><path d="M26 80 C26 64 36 58 50 58 C64 58 74 64 74 80 Z" fill="%23e0f2fe"/></svg>'
                    }
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAvatarUrl(preset.svg)}
                      title={preset.label}
                      className={`relative shrink-0 rounded-full p-0.5 border-2 transition-transform hover:scale-105 ${
                        avatarUrl === preset.svg ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                      }`}
                    >
                      <img src={preset.svg} alt={preset.label} className="w-8 h-8 rounded-full" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">שם מלא (מטופל/ת) *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    placeholder="דוגמה: אברהם בן שרה"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">טלפון ליצירת קשר *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                  <input
                    type="tel"
                    required
                    placeholder="050-0000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">שם האם (חשוב לחישוב קבלי)</label>
                <input
                  type="text"
                  placeholder="דוגמה: שרה"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">תאריך לידה</label>
                <div className="relative">
                  <CalendarIcon className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">כתובת דוא"ל</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">סטטוס בקליניקה</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ClientStatus)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="lead">ליד חדש</option>
                  <option value="consultation">פגישת ייעוץ</option>
                  <option value="active">פעיל בתהליך</option>
                  <option value="waiting">בהמתנה להמשך</option>
                  <option value="inactive">לא פעיל</option>
                  <option value="paid">שולם / סוגר</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">כתובת מגורים / עיר</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="רחוב, מספר, עיר"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Kabbalah Reading Details */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-primary tracking-wide uppercase border-b border-border pb-1 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              אבחון וקריאה קבלית נבחרת
            </h4>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold">סוג הקריאה הקבלית (טקסט חופשי ללא הגבלת תווים)</label>
                <span className="text-[10px] text-muted-foreground font-medium">הקלדה חופשית / הצעות</span>
              </div>
              <input
                type="text"
                placeholder="הקלד סוג קריאה קבלית בטקסט חופשי (למשל: אילן הספירות, עץ החיים, שחרור חסימות...)"
                value={selectedReading}
                onChange={(e) => setSelectedReading(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-muted-foreground ml-1">הצעות מהירות:</span>
                {KABBALAH_READINGS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedReading(r)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-lg border transition-colors ${
                      selectedReading === r
                        ? 'bg-primary/20 text-primary border-primary/40 font-bold'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    + {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Partner Information */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-primary tracking-wide uppercase border-b border-border pb-1 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-500" />
              פרטי בן/בת זוג (להתאמה וזיווג)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">שם מלא בן/בת זוג</label>
                <input
                  type="text"
                  placeholder="רחל בת רבקה"
                  value={partnerFullName}
                  onChange={(e) => setPartnerFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">תאריך לידה בן/בת זוג</label>
                <input
                  type="date"
                  value={partnerDob}
                  onChange={(e) => setPartnerDob(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">שם אם בן/בת זוג</label>
                <input
                  type="text"
                  placeholder="רבקה"
                  value={partnerMotherName}
                  onChange={(e) => setPartnerMotherName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Notes & Therapist */}
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">הערות ותקציר קליני</label>
                <textarea
                  rows={3}
                  placeholder="פרטים נוספים, רקע אנרגטי, סיבת הפנייה..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">מטפל אחראי</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">ללא שיוך מיוחד</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user_name || m.user_email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all"
            >
              {clientToEdit ? 'עדכן פרטי לקוח' : 'צור לקוח חדש'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

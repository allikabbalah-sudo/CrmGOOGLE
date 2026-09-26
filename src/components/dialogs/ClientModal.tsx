import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, MapPin, Calendar as CalendarIcon, Heart, BookOpen, FileText } from 'lucide-react';
import { Client, ClientStatus, KABBALAH_READINGS } from '../../types';
import { useOrganization } from '../../context/OrganizationContext';
import { cleanEmail } from '../../lib/utils';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    onSave({
      full_name: fullName.trim(),
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
              <label className="block text-xs font-semibold mb-1">סוג הקריאה הקבלית</label>
              <select
                value={selectedReading}
                onChange={(e) => setSelectedReading(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">בחר קריאה נבחרת...</option>
                {KABBALAH_READINGS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
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

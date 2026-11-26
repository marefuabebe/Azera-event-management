import React, { useState, useMemo, useRef } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  ShieldCheck,
  Lock,
  Save,
  Camera,
  Check,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  Laptop,
  Clock,
  FileText,
  Receipt,
  CreditCard,
  ChevronRight,
  Calendar,
  Sparkles,
  Layers,
  CheckSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export default function CompanyProfilePage() {
  const { user, setUser } = useAuth();

  // Basic Information State
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '+251 911 000 004');
  const [officeLocation, setOfficeLocation] = useState(user?.profile?.address || 'Bole Sub-City, Mickey Leland St, Addis Ababa');
  const [department, setDepartment] = useState(
    user?.role === 'FINANCE'
      ? 'Finance & Treasury Operations'
      : user?.role === 'COORDINATOR'
      ? 'Client Event Planning & Coordination'
      : 'Executive Administration'
  );
  const [avatarUrl, setAvatarUrl] = useState(user?.profile?.avatarUrl || '');

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Status & Alerts
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const fileInputRef = useRef(null);

  const role = user?.role || 'FINANCE';

  const roleLabels = {
    FINANCE: 'Finance Officer',
    COORDINATOR: 'Event Coordinator',
    ADMIN_DIRECTOR: 'Managing Director',
    STAFF: 'Operations Staff',
    INVENTORY: 'Inventory Manager'
  };

  const roleDisplay = roleLabels[role] || 'Company Officer';

  // Photo Selector
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setAvatarUrl(canvas.toDataURL('image/jpeg', 0.88));
        setProfileError('');
      };
      img.onerror = () => setProfileError('Could not process this image.');
    };
    reader.onerror = () => setProfileError('Could not read the selected file.');
    reader.readAsDataURL(file);
  };

  // Password Strength Calculation
  const passwordStrength = useMemo(() => {
    if (!newPassword) {
      return { score: 0, label: '', color: 'bg-slate-200', percent: 0, rules: [] };
    }
    const rules = [
      { id: 'length', text: 'At least 8 characters', met: newPassword.length >= 8 },
      { id: 'mixed', text: 'Upper & lowercase letters', met: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) },
      { id: 'number', text: 'At least 1 number (0-9)', met: /[0-9]/.test(newPassword) },
      { id: 'special', text: 'Special symbol (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(newPassword) }
    ];
    const score = rules.filter((r) => r.met).length;
    let label = 'Weak';
    let color = 'bg-rose-500';
    let percent = 25;

    if (score === 2) {
      label = 'Fair';
      color = 'bg-amber-500';
      percent = 50;
    } else if (score === 3) {
      label = 'Good';
      color = 'bg-blue-500';
      percent = 75;
    } else if (score === 4) {
      label = 'Strong';
      color = 'bg-emerald-500';
      percent = 100;
    }

    return { score, label, color, percent, rules };
  }, [newPassword]);

  // Save Profile Handler
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess('');
    setProfileError('');

    try {
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        profile: {
          address: officeLocation.trim(),
          avatarUrl,
          department
        }
      };

      const res = await api.updateProfile(payload);
      if (res?.data?.user) {
        setUser(res.data.user);
      }
      setProfileSuccess('Officer profile details updated successfully.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile information.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password Handler
  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    setPasswordSuccess('');
    setPasswordError('');

    try {
      await api.changePassword({ currentPassword, newPassword });
      setPasswordSuccess('Officer credentials updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password. Please verify current password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = fullName
    ? fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'EO';

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <span>Company Portal</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Settings</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#F20047]">Officer Profile</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Officer Profile & Credentials
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your Eventora staff profile, role credentials, security parameters, and operational scope.
          </p>
        </div>
      </div>

      {/* 2. Top Officer Summary Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-7 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md cursor-pointer hover:opacity-95 transition-opacity"
                  title="Click to change photo"
                />
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#F20047] to-rose-400 text-white font-black text-2xl flex items-center justify-center shadow-md cursor-pointer hover:opacity-95 transition-opacity"
                  title="Click to upload photo"
                >
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white text-slate-700 shadow-sm border border-slate-200 flex items-center justify-center hover:text-[#F20047] hover:scale-105 transition-all cursor-pointer"
                title="Upload Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg sm:text-xl font-black text-slate-900">{fullName || 'Corporate Officer'}</h2>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {email} • {department}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  Head Office (Bole Sub-City)
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  EMP-2026-0042
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5 text-slate-500" />
              <span>Change Photo</span>
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl('')}
                className="px-3 py-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold transition-all cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Core Forms (2 Balanced Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Column 1: Staff Professional Details */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-7 space-y-5">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Professional Staff Details</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Official identity and contact information used on auditing records and customer communications.
            </p>
          </div>

          {profileSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}
          {profileError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Official Staff Name"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:outline-hidden focus:border-[#F20047] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Corporate Email Address
                </label>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-500 font-semibold cursor-not-allowed select-none"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Corporate emails are managed by Eventora IT administration.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Direct Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+251 911 000 004"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:outline-hidden focus:border-[#F20047] focus:bg-white transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Department / Unit
                </label>
                <div className="relative">
                  <Layers className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Department Name"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:outline-hidden focus:border-[#F20047] focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Head Office Branch & Address
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={officeLocation}
                  onChange={(e) => setOfficeLocation(e.target.value)}
                  placeholder="Office Location, Sub-City, City"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:outline-hidden focus:border-[#F20047] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-2.5 rounded-xl bg-[#F20047] hover:bg-[#d9003f] text-white text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {savingProfile ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Save className="w-4 h-4 text-white" />
                )}
                <span>{savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Column 2: Security & Password Management */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-7 space-y-5">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Security & Authentication</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Update your corporate password and view active authentication security status.
            </p>
          </div>

          {passwordSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}
          {passwordError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleSavePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="Enter your current password"
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:outline-hidden focus:border-[#F20047] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  New Password
                </label>
                {newPassword && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    passwordStrength.score >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {passwordStrength.label} ({passwordStrength.percent}%)
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:outline-hidden focus:border-[#F20047] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {newPassword && (
                <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="grid grid-cols-4 gap-1.5 h-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full rounded-full transition-all duration-300 ${
                          passwordStrength.score >= step ? passwordStrength.color : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-500">
                    {passwordStrength.rules.map((rule) => (
                      <span key={rule.id} className={`flex items-center gap-1 ${rule.met ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                        {rule.met ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-1" />}
                        {rule.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Confirm New Password
                </label>
                {confirmPassword && (
                  <span className={`text-[10px] font-bold ${newPassword === confirmPassword ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                  </span>
                )}
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter new password"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:outline-hidden focus:border-[#F20047] focus:bg-white transition-all"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savingPassword ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Lock className="w-4 h-4 text-white" />
                )}
                <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


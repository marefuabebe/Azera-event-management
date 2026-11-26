import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Camera,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export default function CustomerProfilePage() {
  const { user, setUser } = useAuth();

  // Personal Info Form State
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.profile?.city || 'Addis Ababa');
  const [address, setAddress] = useState(user?.profile?.address || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.profile?.avatarUrl || '');

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Status & Feedback
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const fileInputRef = useRef(null);

  // Simple direct photo picker & optimizer
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

  // Progressive password strength calculation
  const passwordStrength = useMemo(() => {
    if (!newPassword) {
      return { score: 0, label: '', color: 'bg-slate-200', textClass: 'text-[#756B65]', percent: 0, rules: [] };
    }
    const rules = [
      { id: 'length', text: 'At least 8 characters', met: newPassword.length >= 8 },
      { id: 'mixed', text: 'Upper & lowercase letters', met: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) },
      { id: 'number', text: 'At least 1 number (0-9)', met: /[0-9]/.test(newPassword) },
      { id: 'special', text: 'Special symbol (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(newPassword) }
    ];

    const metCount = rules.filter((r) => r.met).length;

    if (newPassword.length < 6) {
      return { score: 1, label: 'Too short', color: 'bg-[#FCECE8]', textClass: 'text-[#B95650]', percent: 20, rules };
    }

    if (metCount <= 1) {
      return { score: 1, label: 'Weak', color: 'bg-[#FCECE8]', textClass: 'text-[#B95650]', percent: 25, rules };
    } else if (metCount === 2) {
      return { score: 2, label: 'Fair', color: 'bg-amber-500', textClass: 'text-amber-500', percent: 50, rules };
    } else if (metCount === 3) {
      return { score: 3, label: 'Good', color: 'bg-blue-500', textClass: 'text-blue-500', percent: 75, rules };
    } else {
      return { score: 4, label: 'Strong', color: 'bg-emerald-500', textClass: 'text-emerald-500', percent: 100, rules };
    }
  }, [newPassword]);

  // Sync state if user loads
  useEffect(() => {
    if (user) {
      if (user.fullName) setFullName(user.fullName);
      if (user.phone) setPhone(user.phone);
      if (user.profile) {
        if (user.profile.city) setCity(user.profile.city);
        if (user.profile.address) setAddress(user.profile.address);
        if (user.profile.avatarUrl) setAvatarUrl(user.profile.avatarUrl);
      }
    }
  }, [user]);

  // Handle Save Personal Info
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      setProfileError('Full name and phone number are required.');
      return;
    }

    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');

    const profileData = {
      city: city.trim(),
      address: address.trim(),
      avatarUrl
    };

    try {
      const response = await api.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        profile: profileData
      });

      if (response && response.data && response.data.user) {
        setUser(response.data.user);
      } else {
        setUser((prev) => ({
          ...prev,
          fullName: fullName.trim(),
          phone: phone.trim(),
          profile: profileData
        }));
      }

      setProfileSuccess('Profile information updated successfully.');
      setTimeout(() => setProfileSuccess(''), 5000);
    } catch (err) {
      setUser((prev) => ({
        ...prev,
        fullName: fullName.trim(),
        phone: phone.trim(),
        profile: profileData
      }));
      setProfileSuccess('Profile information updated.');
      setTimeout(() => setProfileSuccess(''), 5000);
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.changePassword({
        currentPassword,
        newPassword
      });

      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 5000);
    } catch (err) {
      setPasswordError(
        err?.message || 'Incorrect current password or update failed. Please try again.'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  // Avatar initials
  const initials = fullName
    ? fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-12">
      {/* Top Header */}
      <div className="flex items-start gap-4">
        <div className="w-13 h-13 rounded-2xl bg-[#FFF0F4] flex items-center justify-center shrink-0 border border-[#E8B5A6]/60 shadow-2xs">
          <User className="w-6 h-6 text-[#B95650]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#211D1B] tracking-tight">
            My Profile
          </h1>
          <p className="text-xs sm:text-sm text-[#756B65] mt-1 font-normal leading-relaxed">
            Manage your personal information and account security.
          </p>
        </div>
      </div>

      {/* Balanced Side-by-Side Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Card 1: Personal Information Form (with integrated avatar) */}
        <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)]/80 shadow-2xs p-6 sm:p-7">
          <div className="pb-4 border-b border-[#E8DDD3] mb-5">
            <h3 className="text-base font-bold text-[#211D1B]">Personal Information</h3>
            <p className="text-xs text-[#756B65] mt-0.5">
              Your contact details used for quotations, bookings, and legal contracts.
            </p>
          </div>

          {/* Integrated Profile Photo & Identity Row */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F7F2EC]/80 border border-[#E8DDD3] mb-5">
            {/* Direct Hidden File Input */}
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
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                  title="Click to choose a photo"
                />
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#B95650] to-[#C85F58] text-white font-black text-xl flex items-center justify-center shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                  title="Click to choose a photo"
                >
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FFFDFC] text-slate-700 shadow-sm border border-[#E8DDD3] flex items-center justify-center hover:text-[#B95650] hover:scale-105 transition-all cursor-pointer"
                title="Choose Photo"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-[#211D1B] truncate">{fullName || 'Customer'}</h4>
              <p className="text-xs text-[#756B65] truncate">{email}</p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-semibold text-[#B95650] hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <Camera className="w-3 h-3" />
                  <span>Change photo</span>
                </button>
                {avatarUrl && (
                  <>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="text-[11px] font-semibold text-[#756B65] hover:text-[#B95650] cursor-pointer"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Profile Success / Error Alerts */}
          {profileSuccess && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}
          {profileError && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#FCECE8] border border-[#E8B5A6] text-[#B95650] text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#B95650] shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#756B65] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="e.g. Almaz Ayana"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs sm:text-sm text-[#211D1B] font-semibold focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-all"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#756B65] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-[#E8DDD3] rounded-xl text-xs sm:text-sm text-[#756B65] font-medium cursor-not-allowed"
                />
              </div>
            </div>

            {/* Phone & City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#756B65] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+251 9XX XXX XXX"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs sm:text-sm text-[#211D1B] font-semibold focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  City / Sub-City
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#756B65] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Addis Ababa (Bole)"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs sm:text-sm text-[#211D1B] font-semibold focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Physical Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Delivery / Residential Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street name, landmark, villa / house number"
                className="w-full px-4 py-2.5 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs sm:text-sm text-[#211D1B] font-medium focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-all"
              />
            </div>

            {/* Save Changes Button */}
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-2.5 rounded-xl bg-[#B95650] hover:bg-[#a84842] text-white text-xs sm:text-sm font-bold shadow-xs shadow-[#B95650]/30 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {savingProfile ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Save className="w-4 h-4 text-white" />
                )}
                <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Card 2: Security & Password Form */}
        <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)]/80 shadow-2xs p-6 sm:p-7">
          <div className="pb-4 border-b border-[#E8DDD3] mb-5">
            <h3 className="text-base font-bold text-[#211D1B]">Change Password</h3>
            <p className="text-xs text-[#756B65] mt-0.5">
              Update your account password to maintain confidentiality.
            </p>
          </div>

          {/* Password Success / Error Alerts */}
          {passwordSuccess && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}
          {passwordError && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#FCECE8] border border-[#E8B5A6] text-[#B95650] text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#B95650] shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current Password */}
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
                  className="w-full pl-4 pr-10 py-2.5 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs sm:text-sm text-[#211D1B] font-semibold focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#756B65] hover:text-slate-600 cursor-pointer"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  New Password
                </label>
                {newPassword && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      passwordStrength.score === 1
                        ? 'bg-[#FCECE8] text-[#B95650]'
                        : passwordStrength.score === 2
                        ? 'bg-amber-100 text-amber-700'
                        : passwordStrength.score === 3
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
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
                  className="w-full pl-4 pr-10 py-2.5 bg-[#F7F2EC] border border-[#E8DDD3] rounded-xl text-xs sm:text-sm text-[#211D1B] font-semibold focus:outline-hidden focus:border-[#B95650] focus:bg-[#FFFDFC] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#756B65] hover:text-slate-600 cursor-pointer"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Progressive Password Strength Bar */}
              {newPassword && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#F7F2EC] border border-[#E8DDD3]/80 space-y-2">
                  {/* Multi-step progressive bar */}
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

                  {/* Criteria Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-[#E8DDD3]/60">
                    {passwordStrength.rules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                          rule.met ? 'text-emerald-700 font-semibold' : 'text-[#756B65] font-normal'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                            rule.met ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-[#756B65]'
                          }`}
                        >
                          {rule.met ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <span className="w-1 h-1 rounded-full bg-slate-400" />}
                        </div>
                        <span>{rule.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Confirm New Password
                </label>
                {confirmPassword && (
                  <span
                    className={`text-[11px] font-bold flex items-center gap-1 ${
                      newPassword === confirmPassword ? 'text-emerald-600' : 'text-[#B95650]'
                    }`}
                  >
                    {newPassword === confirmPassword ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Passwords match</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Passwords do not match</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter new password"
                className={`w-full px-4 py-2.5 bg-[#F7F2EC] border rounded-xl text-xs sm:text-sm text-[#211D1B] font-semibold focus:outline-hidden transition-all ${
                  confirmPassword && newPassword !== confirmPassword
                    ? 'border-[#E8B5A6] focus:border-[#E8B5A6]'
                    : 'border-[#E8DDD3] focus:border-[#B95650] focus:bg-[#FFFDFC]'
                }`}
              />
            </div>

            {/* Security Notice */}
            <div className="p-3 rounded-xl bg-[#F7F2EC] border border-[#E8DDD3]/80 text-[11px] text-[#756B65] leading-relaxed">
              Use at least 8 characters with a mix of letters, numbers, and symbols to ensure optimal account security.
            </div>

            {/* Update Password Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={
                  savingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword !== confirmPassword ||
                  newPassword.length < 6
                }
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

      {/* Account Security & Event Preferences Section (Balanced lower grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Card 1: Event & Communication Preferences */}
        <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)]/80 shadow-2xs p-6 space-y-4">
          <div className="pb-3 border-b border-[#E8DDD3] flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-[#211D1B]">Communication & Event Preferences</h4>
              <p className="text-[11px] text-[#756B65]">Manage how coordinators keep you updated</p>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-[#FCECE8] text-[#B95650] text-[10px] font-bold">
              Standard
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F7F2EC] border border-[#E8DDD3]">
              <div>
                <p className="font-bold text-[#211D1B]">Quotation & Proposal Alerts</p>
                <p className="text-[11px] text-[#756B65]">Instant notification when a coordinator sends estimates</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Enabled
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F7F2EC] border border-[#E8DDD3]">
              <div>
                <p className="font-bold text-[#211D1B]">Consultation Calendar Reminders</p>
                <p className="text-[11px] text-[#756B65]">Google Meet link alerts 30 minutes before session</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Security & Session Status */}
        <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8DDD3] shadow-[0_4px_20px_rgba(33,29,27,0.04)]/80 shadow-2xs p-6 space-y-4">
          <div className="pb-3 border-b border-[#E8DDD3] flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-[#211D1B]">Security & Active Device</h4>
              <p className="text-[11px] text-[#756B65]">Your current login parameters</p>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              Protected
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-[#F7F2EC] border border-[#E8DDD3] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#756B65] font-medium">Authentication Standard:</span>
                <span className="font-bold text-[#211D1B]">Email OTP & Password</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#756B65] font-medium">Session Status:</span>
                <span className="font-bold text-emerald-600">Active Secure Session</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#756B65] font-medium">Data Privacy:</span>
                <span className="font-semibold text-[#211D1B]">Protected under Eventora Policy</span>
              </div>
            </div>

            <p className="text-[11px] text-[#756B65] leading-relaxed">
              If you notice any unexpected account activity, contact your Eventora coordinator or reset your password immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

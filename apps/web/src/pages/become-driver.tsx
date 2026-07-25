import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  IdCard,
  Landmark,
  Shield,
  Truck,
  Users,
} from 'lucide-react';
import { api, type User } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageUploadField } from '@/components/image-upload-field';
import {
  emptyLocation,
  LocationPicker,
  locationToApiFields,
  type LocationValue,
} from '@/components/location-picker';

const STEPS = [
  { id: 0, title: 'Identity', icon: IdCard },
  { id: 1, title: 'Vehicle', icon: Truck },
  { id: 2, title: 'Payout', icon: Landmark },
  { id: 3, title: 'Safety', icon: Users },
] as const;

type FormState = {
  legalFullName: string;
  nationalId: string;
  nationalIdFrontUrl: string;
  nationalIdBackUrl: string;
  selfieUrl: string;
  dateOfBirth: string;
  secondaryPhone: string;
  location: LocationValue;
  vehicleType: string;
  vehiclePlate: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear: string;
  vehiclePhotoSideUrl: string;
  vehiclePhotoRearUrl: string;
  vehiclePhotoWithDriverUrl: string;
  licenseNumber: string;
  licenseClass: string;
  licensePhotoUrl: string;
  insuranceDocUrl: string;
  insuranceExpiresAt: string;
  payoutMethod: string;
  payoutPhone: string;
  payoutAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  guarantorName: string;
  guarantorPhone: string;
  guarantorIdNumber: string;
  guarantorAddress: string;
  termsAccepted: boolean;
  dataConsent: boolean;
  trackingConsent: boolean;
};

const initial: FormState = {
  legalFullName: '',
  nationalId: '',
  nationalIdFrontUrl: '',
  nationalIdBackUrl: '',
  selfieUrl: '',
  dateOfBirth: '',
  secondaryPhone: '',
  location: emptyLocation(),
  vehicleType: 'motorcycle',
  vehiclePlate: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleColor: '',
  vehicleYear: '',
  vehiclePhotoSideUrl: '',
  vehiclePhotoRearUrl: '',
  vehiclePhotoWithDriverUrl: '',
  licenseNumber: '',
  licenseClass: '',
  licensePhotoUrl: '',
  insuranceDocUrl: '',
  insuranceExpiresAt: '',
  payoutMethod: 'mobile_money',
  payoutPhone: '',
  payoutAccountName: '',
  bankName: '',
  bankAccountNumber: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
  guarantorName: '',
  guarantorPhone: '',
  guarantorIdNumber: '',
  guarantorAddress: '',
  termsAccepted: false,
  dataConsent: false,
  trackingConsent: false,
};

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Superset of driver KYC columns from /auth/me — used to prefill on resubmit. */
type DriverProfileDraft = {
  status?: string;
  legalFullName?: string;
  nationalId?: string;
  nationalIdFrontUrl?: string;
  nationalIdBackUrl?: string;
  selfieUrl?: string;
  dateOfBirth?: string | null;
  secondaryPhone?: string;
  city?: string;
  addressWard?: string;
  addressStreet?: string;
  addressLandmark?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehicleYear?: number | null;
  vehiclePhotoSideUrl?: string;
  vehiclePhotoRearUrl?: string;
  vehiclePhotoWithDriverUrl?: string;
  licenseNumber?: string;
  licenseClass?: string;
  licensePhotoUrl?: string;
  insuranceDocUrl?: string;
  insuranceExpiresAt?: string | null;
  payoutMethod?: string;
  payoutPhone?: string;
  payoutAccountName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorIdNumber?: string;
  guarantorAddress?: string;
};

/** Prefill from a REJECTED application so the applicant can correct & resubmit.
 *  Consents reset via `...initial`; location IDs are re-picked (names shown). */
function buildInitialDriverForm(user: User | null): FormState {
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  const profile = user?.driverProfile as unknown as
    | DriverProfileDraft
    | undefined;
  const p = profile?.status === 'REJECTED' ? profile : undefined;
  if (!p) {
    return {
      ...initial,
      legalFullName: name,
      payoutPhone: user?.phone || '',
      payoutAccountName: name,
    };
  }
  return {
    ...initial,
    legalFullName: p.legalFullName ?? name,
    nationalId: p.nationalId ?? '',
    nationalIdFrontUrl: p.nationalIdFrontUrl ?? '',
    nationalIdBackUrl: p.nationalIdBackUrl ?? '',
    selfieUrl: p.selfieUrl ?? '',
    dateOfBirth: p.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '',
    secondaryPhone: p.secondaryPhone ?? '',
    location: {
      ...emptyLocation(),
      district: p.city ?? '',
      ward: p.addressWard ?? '',
      street: p.addressStreet ?? '',
      landmark: p.addressLandmark ?? '',
    },
    vehicleType: p.vehicleType ?? 'motorcycle',
    vehiclePlate: p.vehiclePlate ?? '',
    vehicleMake: p.vehicleMake ?? '',
    vehicleModel: p.vehicleModel ?? '',
    vehicleColor: p.vehicleColor ?? '',
    vehicleYear: p.vehicleYear != null ? String(p.vehicleYear) : '',
    vehiclePhotoSideUrl: p.vehiclePhotoSideUrl ?? '',
    vehiclePhotoRearUrl: p.vehiclePhotoRearUrl ?? '',
    vehiclePhotoWithDriverUrl: p.vehiclePhotoWithDriverUrl ?? '',
    licenseNumber: p.licenseNumber ?? '',
    licenseClass: p.licenseClass ?? '',
    licensePhotoUrl: p.licensePhotoUrl ?? '',
    insuranceDocUrl: p.insuranceDocUrl ?? '',
    insuranceExpiresAt: p.insuranceExpiresAt
      ? String(p.insuranceExpiresAt).slice(0, 10)
      : '',
    payoutMethod: p.payoutMethod ?? 'mobile_money',
    payoutPhone: p.payoutPhone ?? user?.phone ?? '',
    payoutAccountName: p.payoutAccountName ?? name,
    bankName: p.bankName ?? '',
    bankAccountNumber: p.bankAccountNumber ?? '',
    emergencyName: p.emergencyName ?? '',
    emergencyPhone: p.emergencyPhone ?? '',
    emergencyRelation: p.emergencyRelation ?? '',
    guarantorName: p.guarantorName ?? '',
    guarantorPhone: p.guarantorPhone ?? '',
    guarantorIdNumber: p.guarantorIdNumber ?? '',
    guarantorAddress: p.guarantorAddress ?? '',
  };
}

export function BecomeDriverPage() {
  const navigate = useNavigate();
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(() =>
    buildInitialDriverForm(user),
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!form.legalFullName.trim()) return 'Legal full name is required';
      if (!form.nationalId.trim()) return 'National ID is required';
      if (!form.nationalIdFrontUrl.trim()) return 'ID front photo URL is required';
      if (!form.nationalIdBackUrl.trim()) return 'ID back photo URL is required';
      if (!form.selfieUrl.trim()) return 'Selfie URL is required';
      if (!form.location.regionId) return 'Select a region';
      if (!form.location.districtId) return 'Select a district';
      if (!form.location.wardId) return 'Select a ward';
      if (!form.location.street.trim()) return 'Street address is required';
    }
    if (s === 1) {
      if (!form.vehiclePlate.trim()) return 'Vehicle plate is required';
      if (!form.licenseNumber.trim()) return 'Licence number is required';
      if (!form.vehiclePhotoSideUrl.trim()) return 'Side vehicle photo is required';
      if (!form.vehiclePhotoRearUrl.trim()) return 'Rear vehicle photo is required';
      if (!form.vehiclePhotoWithDriverUrl.trim())
        return 'Photo of you with the vehicle is required';
      if (!form.licensePhotoUrl.trim()) return 'Licence photo is required';
    }
    if (s === 2) {
      if (!form.payoutAccountName.trim())
        return 'Payout account name (must match ID) is required';
      if (form.payoutMethod === 'mobile_money' && !form.payoutPhone.trim())
        return 'Mobile money number is required';
      if (
        form.payoutMethod === 'bank' &&
        (!form.bankName.trim() || !form.bankAccountNumber.trim())
      )
        return 'Bank name and account number are required';
    }
    if (s === 3) {
      if (!form.emergencyName.trim() || !form.emergencyPhone.trim())
        return 'Emergency contact is required';
      if (!form.termsAccepted || !form.dataConsent || !form.trackingConsent)
        return 'All consents are required';
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((x) => Math.min(3, x + 1));
  };

  const back = () => setStep((x) => Math.max(0, x - 1));

  const submit = async () => {
    const err = validateStep(3);
    if (err) {
      toast.error(err);
      return;
    }
    setLoading(true);
    try {
      const { location: _loc, ...rest } = form;
      const loc = locationToApiFields(form.location);
      const payload = {
        ...rest,
        vehicleYear: form.vehicleYear ? Number(form.vehicleYear) : undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        insuranceExpiresAt: form.insuranceExpiresAt || undefined,
        secondaryPhone: form.secondaryPhone || undefined,
        insuranceDocUrl: form.insuranceDocUrl || undefined,
        guarantorName: form.guarantorName || undefined,
        guarantorPhone: form.guarantorPhone || undefined,
        guarantorIdNumber: form.guarantorIdNumber || undefined,
        guarantorAddress: form.guarantorAddress || undefined,
        vehicleMake: form.vehicleMake || undefined,
        vehicleModel: form.vehicleModel || undefined,
        vehicleColor: form.vehicleColor || undefined,
        licenseClass: form.licenseClass || undefined,
        addressStreet: loc.addressStreet,
        addressArea: loc.addressArea,
        addressWard: loc.addressWard,
        city: loc.city,
        addressLandmark: loc.addressLandmark,
        bankName: form.bankName || undefined,
        bankAccountNumber: form.bankAccountNumber || undefined,
        emergencyRelation: form.emergencyRelation || undefined,
      };
      await api.post('/auth/become-driver', payload);
      await refreshMe();
      toast.success(
        'Application submitted — pending document verification before jobs',
      );
      void navigate('/account');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      toast.error(
        Array.isArray(msg) ? msg.join(', ') : msg || 'Application failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Become a driver</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We verify identity and vehicle so deliveries stay safe and traceable.
        </p>
      </div>

      {/* Step indicator */}
      <ol className="flex gap-1">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const active = step === s.id;
          const done = step > s.id;
          return (
            <li key={s.id} className="flex-1">
              <div
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center',
                  active && 'border-bolt-600 bg-accent-soft',
                  done && 'border-accent-border bg-accent-soft/60',
                  !active && !done && 'border-border bg-card',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs',
                    active || done
                      ? 'bg-bolt-700 text-white'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span className="text-[10px] font-bold text-foreground">
                  {s.title}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {step === 0 && (
          <>
            <p className="text-sm font-bold text-foreground">Identity & address</p>
            <Field label="Legal full name (as on ID)" required>
              <Input
                value={form.legalFullName}
                onChange={(e) => set('legalFullName', e.target.value)}
                required
              />
            </Field>
            <Field label="National ID / NIDA number" required>
              <Input
                value={form.nationalId}
                onChange={(e) => set('nationalId', e.target.value)}
                required
              />
            </Field>
            <ImageUploadField
              label="ID front photo"
              required
              hint="Clear photo of the front of your national ID"
              value={form.nationalIdFrontUrl}
              onChange={(url) => set('nationalIdFrontUrl', url)}
            />
            <ImageUploadField
              label="ID back photo"
              required
              value={form.nationalIdBackUrl}
              onChange={(url) => set('nationalIdBackUrl', url)}
            />
            <ImageUploadField
              label="Selfie"
              required
              hint="Face clearly visible — used to match your ID"
              value={form.selfieUrl}
              onChange={(url) => set('selfieUrl', url)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Date of birth">
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set('dateOfBirth', e.target.value)}
                />
              </Field>
              <Field label="Secondary phone">
                <Input
                  type="tel"
                  placeholder="+255…"
                  value={form.secondaryPhone}
                  onChange={(e) => set('secondaryPhone', e.target.value)}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Choose Region → District → Ward, then type your street.
            </p>
            <LocationPicker
              value={form.location}
              onChange={(location) => set('location', location)}
              showLandmark
            />
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm font-bold text-foreground">Vehicle & licence</p>
            <Field label="Vehicle type" required>
              <select
                className="field-control"
                value={form.vehicleType}
                onChange={(e) => set('vehicleType', e.target.value)}
              >
                <option value="motorcycle">Motorcycle (boda)</option>
                <option value="car">Car</option>
                <option value="van">Van</option>
              </select>
            </Field>
            <Field label="Plate number" required>
              <Input
                value={form.vehiclePlate}
                onChange={(e) => set('vehiclePlate', e.target.value)}
                placeholder="T 123 ABC"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Make">
                <Input
                  value={form.vehicleMake}
                  onChange={(e) => set('vehicleMake', e.target.value)}
                  placeholder="TVS, Bajaj…"
                />
              </Field>
              <Field label="Model">
                <Input
                  value={form.vehicleModel}
                  onChange={(e) => set('vehicleModel', e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Colour">
                <Input
                  value={form.vehicleColor}
                  onChange={(e) => set('vehicleColor', e.target.value)}
                />
              </Field>
              <Field label="Year">
                <Input
                  type="number"
                  value={form.vehicleYear}
                  onChange={(e) => set('vehicleYear', e.target.value)}
                />
              </Field>
            </div>
            <ImageUploadField
              label="Photo — vehicle side (plate visible)"
              required
              value={form.vehiclePhotoSideUrl}
              onChange={(url) => set('vehiclePhotoSideUrl', url)}
            />
            <ImageUploadField
              label="Photo — vehicle rear (plate visible)"
              required
              value={form.vehiclePhotoRearUrl}
              onChange={(url) => set('vehiclePhotoRearUrl', url)}
            />
            <ImageUploadField
              label="Photo — you with the vehicle"
              required
              value={form.vehiclePhotoWithDriverUrl}
              onChange={(url) => set('vehiclePhotoWithDriverUrl', url)}
            />
            <Field label="Driving licence number" required>
              <Input
                value={form.licenseNumber}
                onChange={(e) => set('licenseNumber', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Licence class">
                <Input
                  value={form.licenseClass}
                  onChange={(e) => set('licenseClass', e.target.value)}
                  placeholder="A, B…"
                />
              </Field>
              <Field label="Insurance expiry">
                <Input
                  type="date"
                  value={form.insuranceExpiresAt}
                  onChange={(e) => set('insuranceExpiresAt', e.target.value)}
                />
              </Field>
            </div>
            <ImageUploadField
              label="Licence photo"
              required
              value={form.licensePhotoUrl}
              onChange={(url) => set('licensePhotoUrl', url)}
            />
            <ImageUploadField
              label="Insurance document (optional)"
              value={form.insuranceDocUrl}
              onChange={(url) => set('insuranceDocUrl', url)}
            />
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm font-bold text-foreground">Payout account</p>
            <p className="text-xs text-muted-foreground">
              Account name must match your national ID name. Earnings are only
              paid to a verified matching account.
            </p>
            <Field label="Payout method" required>
              <select
                className="field-control"
                value={form.payoutMethod}
                onChange={(e) => set('payoutMethod', e.target.value)}
              >
                <option value="mobile_money">Mobile money</option>
                <option value="bank">Bank account</option>
              </select>
            </Field>
            <Field label="Account holder name (as registered)" required>
              <Input
                value={form.payoutAccountName}
                onChange={(e) => set('payoutAccountName', e.target.value)}
              />
            </Field>
            {form.payoutMethod === 'mobile_money' ? (
              <Field label="Mobile money number" required>
                <Input
                  type="tel"
                  placeholder="+2557…"
                  value={form.payoutPhone}
                  onChange={(e) => set('payoutPhone', e.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field label="Bank name" required>
                  <Input
                    value={form.bankName}
                    onChange={(e) => set('bankName', e.target.value)}
                  />
                </Field>
                <Field label="Account number" required>
                  <Input
                    value={form.bankAccountNumber}
                    onChange={(e) => set('bankAccountNumber', e.target.value)}
                  />
                </Field>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm font-bold text-foreground">
              Emergency contact & guarantor
            </p>
            <Field label="Emergency contact name" required>
              <Input
                value={form.emergencyName}
                onChange={(e) => set('emergencyName', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Emergency phone" required>
                <Input
                  type="tel"
                  placeholder="+255…"
                  value={form.emergencyPhone}
                  onChange={(e) => set('emergencyPhone', e.target.value)}
                />
              </Field>
              <Field label="Relationship">
                <Input
                  value={form.emergencyRelation}
                  onChange={(e) => set('emergencyRelation', e.target.value)}
                  placeholder="Sibling, spouse…"
                />
              </Field>
            </div>

            <p className="pt-2 text-xs font-bold uppercase text-muted-foreground">
              Guarantor (recommended)
            </p>
            <Field label="Guarantor full name">
              <Input
                value={form.guarantorName}
                onChange={(e) => set('guarantorName', e.target.value)}
              />
            </Field>
            <Field label="Guarantor phone">
              <Input
                type="tel"
                value={form.guarantorPhone}
                onChange={(e) => set('guarantorPhone', e.target.value)}
              />
            </Field>
            <Field label="Guarantor ID number">
              <Input
                value={form.guarantorIdNumber}
                onChange={(e) => set('guarantorIdNumber', e.target.value)}
              />
            </Field>
            <Field label="Guarantor address">
              <Input
                value={form.guarantorAddress}
                onChange={(e) => set('guarantorAddress', e.target.value)}
              />
            </Field>

            <div className="space-y-3 rounded-xl border border-accent-border bg-accent-soft p-3">
              <p className="flex items-center gap-2 text-sm font-bold text-accent-soft-foreground">
                <Shield className="h-4 w-4" /> Legal consents
              </p>
              {(
                [
                  [
                    'termsAccepted',
                    'I accept the driver partner terms and am responsible for parcels in my care',
                  ],
                  [
                    'dataConsent',
                    'I consent to processing of my ID, photos, and personal data for verification and fraud prevention (including sharing with authorities if theft is reported)',
                  ],
                  [
                    'trackingConsent',
                    'I consent to GPS location tracking while I am on an active delivery job',
                  ],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-2 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-border"
                    checked={form[key]}
                    onChange={(e) => set(key, e.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2">
        {step > 0 && (
          <Button type="button" variant="secondary" onClick={back} className="flex-1">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        )}
        {step < 3 ? (
          <Button type="button" onClick={next} className="flex-1">
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            loading={loading}
            onClick={() => void submit()}
            className="flex-1"
          >
            Submit application
          </Button>
        )}
      </div>
    </div>
  );
}

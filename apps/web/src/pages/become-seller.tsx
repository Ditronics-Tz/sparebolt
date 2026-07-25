import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  IdCard,
  Landmark,
  MapPin,
  Shield,
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
  { id: 0, title: 'Business', icon: Building2 },
  { id: 1, title: 'Identity', icon: IdCard },
  { id: 2, title: 'Location', icon: MapPin },
  { id: 3, title: 'Payout', icon: Landmark },
] as const;

type FormState = {
  businessName: string;
  businessType: string;
  description: string;
  registrationNumber: string;
  tinNumber: string;
  yearsTrading: string;
  legalFullName: string;
  nationalId: string;
  nationalIdFrontUrl: string;
  nationalIdBackUrl: string;
  selfieUrl: string;
  dateOfBirth: string;
  secondaryPhone: string;
  location: LocationValue;
  shopExteriorUrl: string;
  shopInteriorUrl: string;
  payoutMethod: string;
  payoutPhone: string;
  payoutAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  termsAccepted: boolean;
  dataConsent: boolean;
  accurateListingConsent: boolean;
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

/** All KYC columns returned by /auth/me for a seller profile (superset of the
 *  trimmed shared type) — used only to prefill the form on resubmission. */
type SellerProfileDraft = {
  status?: string;
  businessName?: string;
  businessType?: string;
  description?: string;
  registrationNumber?: string;
  tinNumber?: string;
  yearsTrading?: number | null;
  legalFullName?: string;
  nationalId?: string;
  nationalIdFrontUrl?: string;
  nationalIdBackUrl?: string;
  selfieUrl?: string;
  dateOfBirth?: string | null;
  secondaryPhone?: string;
  region?: string;
  city?: string;
  addressWard?: string;
  addressStreet?: string;
  addressLandmark?: string;
  shopExteriorUrl?: string;
  shopInteriorUrl?: string;
  payoutMethod?: string;
  payoutPhone?: string;
  payoutAccountName?: string;
  bankName?: string;
  bankAccountNumber?: string;
};

/** Prefill from an existing REJECTED application so the applicant can correct
 *  and resubmit; otherwise start blank. Consents always reset (re-accept). */
function buildInitialSellerForm(user: User | null): FormState {
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  const profile = user?.sellerProfile as unknown as
    | SellerProfileDraft
    | undefined;
  const p = profile?.status === 'REJECTED' ? profile : undefined;
  return {
    businessName: p?.businessName ?? '',
    businessType: p?.businessType ?? 'individual',
    description: p?.description ?? '',
    registrationNumber: p?.registrationNumber ?? '',
    tinNumber: p?.tinNumber ?? '',
    yearsTrading: p?.yearsTrading != null ? String(p.yearsTrading) : '',
    legalFullName: p?.legalFullName ?? name,
    nationalId: p?.nationalId ?? '',
    nationalIdFrontUrl: p?.nationalIdFrontUrl ?? '',
    nationalIdBackUrl: p?.nationalIdBackUrl ?? '',
    selfieUrl: p?.selfieUrl ?? '',
    dateOfBirth: p?.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '',
    secondaryPhone: p?.secondaryPhone ?? '',
    location: {
      ...emptyLocation(),
      region: p?.region ?? '',
      district: p?.city ?? '',
      ward: p?.addressWard ?? '',
      street: p?.addressStreet ?? '',
      landmark: p?.addressLandmark ?? '',
    },
    shopExteriorUrl: p?.shopExteriorUrl ?? '',
    shopInteriorUrl: p?.shopInteriorUrl ?? '',
    payoutMethod: p?.payoutMethod ?? 'mobile_money',
    payoutPhone: p?.payoutPhone ?? user?.phone ?? '',
    payoutAccountName: p?.payoutAccountName ?? name,
    bankName: p?.bankName ?? '',
    bankAccountNumber: p?.bankAccountNumber ?? '',
    termsAccepted: false,
    dataConsent: false,
    accurateListingConsent: false,
  };
}

export function BecomeSellerPage() {
  const navigate = useNavigate();
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(() =>
    buildInitialSellerForm(user),
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!form.businessName.trim()) return 'Business / trading name is required';
      if (form.businessType === 'company' && !form.registrationNumber.trim()) {
        return 'Registration number is required for companies';
      }
    }
    if (s === 1) {
      if (!form.legalFullName.trim()) return 'Legal full name is required';
      if (!form.nationalId.trim()) return 'National ID is required';
      if (!form.nationalIdFrontUrl) return 'ID front photo is required';
      if (!form.nationalIdBackUrl) return 'ID back photo is required';
      if (!form.selfieUrl) return 'Selfie is required';
    }
    if (s === 2) {
      if (!form.location.regionId) return 'Select a region';
      if (!form.location.districtId) return 'Select a district';
      if (!form.location.wardId) return 'Select a ward';
      if (!form.location.street.trim()) return 'Street address is required';
    }
    if (s === 3) {
      if (!form.payoutAccountName.trim())
        return 'Payout account name (must match ID) is required';
      if (form.payoutMethod === 'mobile_money' && !form.payoutPhone.trim())
        return 'Mobile money number is required';
      if (
        form.payoutMethod === 'bank' &&
        (!form.bankName.trim() || !form.bankAccountNumber.trim())
      )
        return 'Bank name and account number are required';
      if (
        !form.termsAccepted ||
        !form.dataConsent ||
        !form.accurateListingConsent
      )
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
      await api.post('/auth/become-seller', {
        businessName: form.businessName,
        businessType: form.businessType,
        description: form.description || undefined,
        registrationNumber: form.registrationNumber || undefined,
        tinNumber: form.tinNumber || undefined,
        yearsTrading: form.yearsTrading
          ? Number(form.yearsTrading)
          : undefined,
        legalFullName: form.legalFullName,
        nationalId: form.nationalId,
        nationalIdFrontUrl: form.nationalIdFrontUrl,
        nationalIdBackUrl: form.nationalIdBackUrl,
        selfieUrl: form.selfieUrl,
        dateOfBirth: form.dateOfBirth || undefined,
        secondaryPhone: form.secondaryPhone || undefined,
        ...(() => {
          const loc = locationToApiFields(form.location);
          return {
            addressStreet: loc.addressStreet,
            addressArea: loc.addressArea,
            addressWard: loc.addressWard,
            city: loc.city,
            region: loc.region,
            addressLandmark: loc.addressLandmark,
          };
        })(),
        shopExteriorUrl: form.shopExteriorUrl || undefined,
        shopInteriorUrl: form.shopInteriorUrl || undefined,
        payoutMethod: form.payoutMethod,
        payoutPhone: form.payoutPhone || undefined,
        payoutAccountName: form.payoutAccountName,
        bankName: form.bankName || undefined,
        bankAccountNumber: form.bankAccountNumber || undefined,
        termsAccepted: form.termsAccepted,
        dataConsent: form.dataConsent,
        accurateListingConsent: form.accurateListingConsent,
      });
      await refreshMe();
      toast.success(
        'Application submitted — pending verification before you can list parts',
      );
      void navigate('/account');
    } catch (e: unknown) {
      const msg = (
        e as { response?: { data?: { message?: string | string[] } } }
      )?.response?.data?.message;
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
        <h1 className="font-display text-2xl font-extrabold">
          Become a seller
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We verify identity and shop details so buyers can trust your listings.
        </p>
      </div>

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
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
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
            <p className="text-sm font-bold text-foreground">Business details</p>
            <Field label="Business / trading name" required>
              <Input
                value={form.businessName}
                onChange={(e) => set('businessName', e.target.value)}
              />
            </Field>
            <Field label="Business type" required>
              <select
                className="field-control"
                value={form.businessType}
                onChange={(e) => set('businessType', e.target.value)}
              >
                <option value="individual">Individual / sole trader</option>
                <option value="partnership">Partnership</option>
                <option value="company">Registered company</option>
              </select>
            </Field>
            <Field label="Description">
              <textarea
                className="field-control"
                placeholder="What parts do you specialise in?"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Registration no."
                required={form.businessType === 'company'}
                hint={
                  form.businessType === 'company'
                    ? 'BRELA / company number'
                    : 'Optional'
                }
              >
                <Input
                  value={form.registrationNumber}
                  onChange={(e) => set('registrationNumber', e.target.value)}
                />
              </Field>
              <Field label="TIN (optional)">
                <Input
                  value={form.tinNumber}
                  onChange={(e) => set('tinNumber', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Years trading">
              <Input
                type="number"
                min={0}
                value={form.yearsTrading}
                onChange={(e) => set('yearsTrading', e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm font-bold text-foreground">
              Responsible person identity
            </p>
            <p className="text-xs text-muted-foreground">
              The person who will be legally responsible for listings and
              escrow.
            </p>
            <Field label="Legal full name (as on ID)" required>
              <Input
                value={form.legalFullName}
                onChange={(e) => set('legalFullName', e.target.value)}
              />
            </Field>
            <Field label="National ID / NIDA number" required>
              <Input
                value={form.nationalId}
                onChange={(e) => set('nationalId', e.target.value)}
              />
            </Field>
            <ImageUploadField
              label="ID front photo"
              required
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
              hint="Face clearly visible — matched to your ID"
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
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm font-bold text-foreground">
              Shop / stock location
            </p>
            <p className="text-xs text-muted-foreground">
              Choose Region → District → Ward, then type the street.
            </p>
            <LocationPicker
              value={form.location}
              onChange={(location) => set('location', location)}
              showLandmark
            />
            <ImageUploadField
              label="Shop exterior photo (recommended)"
              hint="Helps us verify a real trading location"
              value={form.shopExteriorUrl}
              onChange={(url) => set('shopExteriorUrl', url)}
            />
            <ImageUploadField
              label="Stock / interior photo (optional)"
              value={form.shopInteriorUrl}
              onChange={(url) => set('shopInteriorUrl', url)}
            />
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm font-bold text-foreground">Payout & terms</p>
            <p className="text-xs text-muted-foreground">
              Escrow releases only to an account whose name matches your ID.
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

            <div className="space-y-3 rounded-xl border border-accent-border bg-accent-soft p-3">
              <p className="flex items-center gap-2 text-sm font-bold text-accent-soft-foreground">
                <Shield className="h-4 w-4" /> Legal consents
              </p>
              {(
                [
                  [
                    'termsAccepted',
                    'I accept the seller agreement and escrow rules. I am responsible for parts I list.',
                  ],
                  [
                    'dataConsent',
                    'I consent to processing of my ID, photos, and business data for verification and fraud prevention (including sharing with authorities if fraud is reported).',
                  ],
                  [
                    'accurateListingConsent',
                    'I confirm listings will be accurate (condition, fitment, photos) and I will not sell stolen or prohibited parts.',
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
          <Button
            type="button"
            variant="secondary"
            onClick={back}
            className="flex-1"
          >
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

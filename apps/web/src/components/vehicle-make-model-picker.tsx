import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Make = {
  id: string;
  name: string;
  models: { id: string; name: string }[];
};

// Fetch the reference list once per session and share it across every picker.
let cache: Make[] | null = null;
let inflight: Promise<Make[]> | null = null;

async function loadMakes(): Promise<Make[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = api
      .get<Make[]>('/listings/vehicles/makes')
      .then((r) => {
        cache = Array.isArray(r.data) ? r.data : [];
        return cache;
      })
      .catch(() => {
        inflight = null;
        return [];
      });
  }
  return inflight;
}

/**
 * Two dependent dropdowns (make → model) fed by the seeded vehicle catalogue.
 * Values are the make/model *names* to match the string columns used for
 * listings and driver vehicles. Any legacy free-typed value is preserved as a
 * selectable option so existing records still display correctly.
 */
export function VehicleMakeModelPicker({
  make,
  model,
  onChange,
  className,
  makeLabel = 'Make',
  modelLabel = 'Model',
}: {
  make: string;
  model: string;
  onChange: (make: string, model: string) => void;
  className?: string;
  makeLabel?: string;
  modelLabel?: string;
}) {
  const [makes, setMakes] = useState<Make[]>(cache ?? []);

  useEffect(() => {
    let alive = true;
    void loadMakes().then((m) => {
      if (alive) setMakes(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  const selectedMake = makes.find((m) => m.name === make);
  const makeOptions = makes.map((m) => m.name);
  const modelOptions = (selectedMake?.models ?? []).map((m) => m.name);
  const showLegacyMake = Boolean(make) && !makeOptions.includes(make);
  const showLegacyModel = Boolean(model) && !modelOptions.includes(model);

  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <select
        className="field-control"
        value={make}
        aria-label={makeLabel}
        onChange={(e) => onChange(e.target.value, '')}
      >
        <option value="">{makeLabel}</option>
        {showLegacyMake && <option value={make}>{make}</option>}
        {makeOptions.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        className="field-control"
        value={model}
        aria-label={modelLabel}
        disabled={!make}
        onChange={(e) => onChange(make, e.target.value)}
      >
        <option value="">{make ? modelLabel : 'Select make first'}</option>
        {showLegacyModel && <option value={model}>{model}</option>}
        {modelOptions.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

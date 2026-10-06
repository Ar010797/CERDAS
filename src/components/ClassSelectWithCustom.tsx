import React, { useState, useEffect } from 'react';
import { ALL_AVAILABLE_CLASSES, CLASS_GROUPS } from '../lib/schoolClasses';
import { PenTool, Check, ChevronDown } from 'lucide-react';

interface ClassSelectWithCustomProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  showAllClassesOption?: boolean;
  allClassesLabel?: string;
  placeholder?: string;
}

const CUSTOM_OPTION_KEY = '__CUSTOM_CLASS_INPUT__';

export default function ClassSelectWithCustom({
  value,
  onChange,
  id,
  name,
  label,
  className = '',
  disabled = false,
  required = false,
  showAllClassesOption = false,
  allClassesLabel = 'Semua Kelas',
  placeholder = 'Pilih kelas atau input manual...'
}: ClassSelectWithCustomProps) {
  // Check if current value exists in the predefined list
  const isPredefined = ALL_AVAILABLE_CLASSES.includes(value) || (showAllClassesOption && value === allClassesLabel);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(!isPredefined && Boolean(value && value !== ''));
  const [customInputValue, setCustomInputValue] = useState<string>(!isPredefined ? value : '');

  // Keep internal custom value synced if parent value changes from outside
  useEffect(() => {
    const isValPredefined = ALL_AVAILABLE_CLASSES.includes(value) || (showAllClassesOption && value === allClassesLabel);
    if (!isValPredefined && value) {
      setIsCustomMode(true);
      setCustomInputValue(value);
    } else if (isValPredefined && !isCustomMode) {
      setCustomInputValue('');
    }
  }, [value, showAllClassesOption, allClassesLabel]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === CUSTOM_OPTION_KEY) {
      setIsCustomMode(true);
      // If there was no custom input yet, suggest the previous or default
      const defaultVal = customInputValue || 'Kelas 1 A';
      setCustomInputValue(defaultVal);
      onChange(defaultVal);
    } else {
      setIsCustomMode(false);
      onChange(selected);
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInputValue(val);
    onChange(val);
  };

  return (
    <div className="space-y-2 w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          id={id}
          name={name}
          disabled={disabled}
          required={required && !isCustomMode}
          value={isCustomMode ? CUSTOM_OPTION_KEY : value}
          onChange={handleSelectChange}
          className={className || "w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"}
        >
          {showAllClassesOption && (
            <option value={allClassesLabel}>{allClassesLabel}</option>
          )}

          {!value && !showAllClassesOption && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}

          {/* Group 1: Kelas 1 - 6 (A, B, C) */}
          <optgroup label="Tingkat SD / MI (Kelas 1 - 6 dengan Pilihan A, B, C)">
            <option value="Kelas 1 A">Kelas 1 A</option>
            <option value="Kelas 1 B">Kelas 1 B</option>
            <option value="Kelas 1 C">Kelas 1 C</option>
            <option value="Kelas 1">Kelas 1 (Umum)</option>
            <option value="Kelas 2 A">Kelas 2 A</option>
            <option value="Kelas 2 B">Kelas 2 B</option>
            <option value="Kelas 2 C">Kelas 2 C</option>
            <option value="Kelas 2">Kelas 2 (Umum)</option>
            <option value="Kelas 3 A">Kelas 3 A</option>
            <option value="Kelas 3 B">Kelas 3 B</option>
            <option value="Kelas 3 C">Kelas 3 C</option>
            <option value="Kelas 3">Kelas 3 (Umum)</option>
            <option value="Kelas 4 A">Kelas 4 A</option>
            <option value="Kelas 4 B">Kelas 4 B</option>
            <option value="Kelas 4 C">Kelas 4 C</option>
            <option value="Kelas 4">Kelas 4 (Umum)</option>
            <option value="Kelas 5 A">Kelas 5 A</option>
            <option value="Kelas 5 B">Kelas 5 B</option>
            <option value="Kelas 5 C">Kelas 5 C</option>
            <option value="Kelas 5">Kelas 5 (Umum)</option>
            <option value="Kelas 6 A">Kelas 6 A</option>
            <option value="Kelas 6 B">Kelas 6 B</option>
            <option value="Kelas 6 C">Kelas 6 C</option>
            <option value="Kelas 6">Kelas 6 (Umum)</option>
          </optgroup>

          {/* Group 2: Kelas 7 - 9 (A, B, C) */}
          <optgroup label="Tingkat MTs / SMP (Kelas 7 - 9)">
            <option value="Kelas 7 MTs">Kelas 7 MTs</option>
            <option value="Kelas 7 MTs A">Kelas 7 MTs A</option>
            <option value="Kelas 7 MTs B">Kelas 7 MTs B</option>
            <option value="Kelas 7 A">Kelas 7 A</option>
            <option value="Kelas 7 B">Kelas 7 B</option>
            <option value="Kelas 7 C">Kelas 7 C</option>
            <option value="Kelas 7">Kelas 7 (Umum)</option>
            <option value="Kelas 8 MTs">Kelas 8 MTs</option>
            <option value="Kelas 8 MTs A">Kelas 8 MTs A</option>
            <option value="Kelas 8 MTs B">Kelas 8 MTs B</option>
            <option value="Kelas 8 A">Kelas 8 A</option>
            <option value="Kelas 8 B">Kelas 8 B</option>
            <option value="Kelas 8 C">Kelas 8 C</option>
            <option value="Kelas 8">Kelas 8 (Umum)</option>
            <option value="Kelas 9 MTs">Kelas 9 MTs</option>
            <option value="Kelas 9 MTs A">Kelas 9 MTs A</option>
            <option value="Kelas 9 MTs B">Kelas 9 MTs B</option>
            <option value="Kelas 9 A">Kelas 9 A</option>
            <option value="Kelas 9 B">Kelas 9 B</option>
            <option value="Kelas 9 C">Kelas 9 C</option>
            <option value="Kelas 9">Kelas 9 (Umum)</option>
          </optgroup>

          {/* Special Option: Custom Input */}
          <optgroup label="Pilihan Bebas / Kustom">
            <option value={CUSTOM_OPTION_KEY}>
              ✍️ Masukkan Nama Kelas Manual (Kustom)...
            </option>
          </optgroup>
        </select>
      </div>

      {/* Manual text input appears when custom mode is selected */}
      {isCustomMode && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                disabled={disabled}
                required={required}
                value={customInputValue}
                onChange={handleCustomInputChange}
                placeholder="Contoh: Kelas 1 A, Kelas 2 B, Kelas Tahfidz, Kelas Unggulan"
                className="w-full px-3.5 py-2 pl-9 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 text-slate-800 dark:text-slate-100 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
              />
              <PenTool className="w-4 h-4 text-amber-600 dark:text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={() => {
                setIsCustomMode(false);
                onChange('Kelas 1 A');
              }}
              className="px-2.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Kembali ke pilihan dropdown daftar kelas"
            >
              Batal
            </button>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
            Ketik nama kelas yang Anda inginkan (misal: <b>Kelas 1 A</b>, <b>Kelas 1 B</b>, <b>Kelas 1 C</b>, atau lainnya).
          </p>
        </div>
      )}
    </div>
  );
}

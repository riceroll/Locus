import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus } from 'lucide-react';
import { useSettingsStore, ACCENT_PRESETS } from '../../store/useSettingsStore';

export type ColorPickerVariant = 'floating' | 'inline';

interface UnifiedColorPickerProps {
  current: string;
  onSelect: (color: string) => void;
  variant?: ColorPickerVariant;
  position?: { top: number; left: number };
}

export const UnifiedColorPicker: React.FC<UnifiedColorPickerProps> = ({
  current,
  onSelect,
  variant = 'inline',
  position = { top: 0, left: 0 },
}) => {
  const { customColors = [], setCustomColors } = useSettingsStore();

  const handleUpdateCustomColor = (index: number, color: string) => {
    const updated = [...customColors];
    if (index >= updated.length) {
      updated.push(color);
    } else {
      updated[index] = color;
    }
    // ensure max 7
    if (updated.length > 7) updated.splice(7);
    setCustomColors(updated);
    onSelect(color);
  };

  const handleDeleteCustomColor = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const updated = [...customColors];
    updated.splice(index, 1);
    setCustomColors(updated);
  };

  const containerClasses = variant === 'floating'
    ? 'fixed bg-white dark:bg-neutral-900 rounded-xl shadow-xl p-3 z-[99999] border border-neutral-200/80 dark:border-neutral-700/80 w-[220px]'
    : 'bg-transparent';

  const positionStyle = variant === 'floating'
    ? { top: `${position.top}px`, left: `${position.left}px` }
    : {};

  const currStr = current || '';

  const content = (
    <div
      className={containerClasses}
      style={positionStyle}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
    >
      {/* Preset Colors Grid */}
      <div className="mb-3">
        <div className="grid grid-cols-7 gap-1.5">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              title={preset.key}
              onClick={() => onSelect(preset.key)}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                currStr === preset.key
                  ? 'border-neutral-800 dark:border-neutral-200 scale-110'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: preset.swatch }}
            />
          ))}
        </div>
      </div>

      {/* Custom Colors Section */}
      <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800">
        <div className="grid grid-cols-7 gap-1.5 items-center">
          {Array.from({ length: 7 }).map((_, i) => {
            const color = customColors[i];
            
            if (color) {
              return (
                <div key={`custom-${i}`} className="relative group">
                  <div
                    className={`relative flex items-center justify-center w-6 h-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
                      currStr === color
                        ? 'border-neutral-800 dark:border-neutral-200 scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    title="Select custom color"
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(color)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      title="Select custom color"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustomColor(e, i)}
                    className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 bg-neutral-800 dark:bg-neutral-600 text-white rounded-full hover:bg-red-500 dark:hover:bg-red-500 z-10 transition-colors"
                    title="Remove color"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            }

            // Empty slot
            return (
              <label
                key={`empty-${i}`}
                className="relative flex items-center justify-center w-6 h-6 rounded-full border-2 border-dashed border-neutral-200 dark:border-neutral-700 opacity-50 hover:opacity-100 hover:border-neutral-400 dark:hover:border-neutral-500 cursor-pointer transition-colors group"
                title="Add custom color"
              >
                <Plus className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 hidden group-hover:flex" />
                <input
                  type="color"
                  value="#347285"
                  onChange={(e) => handleUpdateCustomColor(i, e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );

  return variant === 'floating' ? createPortal(content, document.body) : content;
};


export const ColorPickerDropdown = ({
  current,
  onSelect,
}: {
  current: string;
  onSelect: (color: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [isOpen]);

  const toggle = () => setIsOpen(!isOpen);

  const dotColor = current || '#347285';

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="flex items-center justify-between gap-3 min-w-[120px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700/50 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-500 transition text-sm text-neutral-600 dark:text-neutral-300"
      >
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 shadow-sm" style={{ backgroundColor: dotColor }} />
          <span className="font-mono text-[13px]">{dotColor.toUpperCase()}</span>
        </span>
      </button>
      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            setIsOpen(false);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {isOpen && (
        <UnifiedColorPicker
          current={current}
          onSelect={(c) => { onSelect(c); setIsOpen(false); }}
          variant="floating"
          position={pos}
        />
      )}
    </div>
  );
};

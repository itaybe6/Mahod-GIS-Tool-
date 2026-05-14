import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ToggleSwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

/**
 * Compact iOS-style toggle, RTL-aware (knob slides in the logical-end direction).
 */
export const ToggleSwitch = forwardRef<HTMLButtonElement, ToggleSwitchProps>(
  ({ className, checked, onCheckedChange, label, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'relative h-[18px] w-8 shrink-0 rounded-full transition-colors',
        checked ? 'bg-gradient-to-br from-brand-teal to-brand-teal2' : 'bg-[#374151]',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[14px] w-[14px] rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-all',
          checked ? 'end-[calc(100%-16px)] bg-white' : 'end-[2px] bg-[#e5e7eb]'
        )}
      />
    </button>
  )
);
ToggleSwitch.displayName = 'ToggleSwitch';

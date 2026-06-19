import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/utils';

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onCheckedChange, id, disabled }: ToggleProps) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-wollama-primary)] focus-visible:ring-offset-2',
        checked ? 'bg-[var(--color-wollama-primary)]' : 'bg-zinc-200',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm',
          'transform ring-0 transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </SwitchPrimitive.Root>
  );
}

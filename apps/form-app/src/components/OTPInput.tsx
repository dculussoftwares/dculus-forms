import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Input } from '@dculus/ui';
import { cn } from '@dculus/utils';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
}

export const OTPInput = ({ 
  length = 6, 
  value, 
  onChange, 
  disabled = false,
  hasError = false,
  autoFocus = true
}: OTPInputProps) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(autoFocus ? 0 : -1);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize input refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  // Focus management when value changes
  useEffect(() => {
    const nextEmptyIndex = value.length;
    if (nextEmptyIndex < length && inputRefs.current[nextEmptyIndex]) {
      inputRefs.current[nextEmptyIndex]?.focus();
      setFocusedIndex(nextEmptyIndex);
    }
  }, [value, length]);

  const handleInputChange = (index: number, inputValue: string) => {
    // Only allow digits
    const digit = inputValue.replace(/[^0-9]/g, '').slice(-1);
    
    const newValue = value.split('');
    newValue[index] = digit;
    
    // Remove empty slots at the end
    while (newValue.length > 0 && newValue[newValue.length - 1] === undefined) {
      newValue.pop();
    }
    
    const updatedValue = newValue.join('').slice(0, length);
    onChange(updatedValue);

    // Move to next input if digit was entered
    if (digit && index < length - 1) {
      const nextIndex = index + 1;
      inputRefs.current[nextIndex]?.focus();
      setFocusedIndex(nextIndex);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;

    if (e.key === 'Backspace') {
      if (target.value) {
        // Clear current input
        handleInputChange(index, '');
      } else if (index > 0) {
        // Move to previous input and clear it
        const prevIndex = index - 1;
        inputRefs.current[prevIndex]?.focus();
        setFocusedIndex(prevIndex);
        handleInputChange(prevIndex, '');
      }
    } else if (e.key === 'Delete') {
      handleInputChange(index, '');
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      const prevIndex = index - 1;
      inputRefs.current[prevIndex]?.focus();
      setFocusedIndex(prevIndex);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      const nextIndex = index + 1;
      inputRefs.current[nextIndex]?.focus();
      setFocusedIndex(nextIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Submit form if OTP is complete
      if (value.length === length) {
        const form = target.closest('form');
        form?.requestSubmit();
      }
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(-1);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/[^0-9]/g, '').slice(0, length);
    onChange(digits);
    
    // Focus the next empty input or last input
    const nextIndex = Math.min(digits.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
    setFocusedIndex(nextIndex);
  };

  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length }, (_, index) => (
        <Input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleInputChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={() => handleFocus(index)}
          onBlur={handleBlur}
          onPaste={handlePaste}
          disabled={disabled}
          className={cn(
            "w-12 h-12 text-center text-lg font-semibold",
            "border-2 rounded-lg transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            focusedIndex === index && "border-primary ring-2 ring-primary/20",
            hasError && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            disabled && "opacity-50 cursor-not-allowed",
            value[index] && "border-green-500 bg-green-50"
          )}
          autoComplete="one-time-code"
          data-testid={`otp-input-${index}`}
        />
      ))}
    </div>
  );
};
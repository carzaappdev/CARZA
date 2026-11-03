import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  /** Rendered inside the input's box, on the right (e.g. a show-password toggle). */
  children?: ReactNode;
};

export function Field({ label, name, error, hint, children, className, ...input }: FieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'border-input placeholder:text-muted-foreground/70 aria-invalid:border-destructive aria-invalid:ring-destructive/15 bg-background hover:border-foreground/25 focus-visible:border-foreground focus-visible:ring-foreground/10 h-12 w-full rounded-xl border px-4 text-base transition outline-none focus-visible:ring-4',
            className,
          )}
          {...input}
        />
        {children}
      </div>
      {error ? (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: 'error' | 'success'; children: string }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm'
          : 'bg-success/10 text-success rounded-xl px-4 py-3 text-sm'
      }
    >
      {children}
    </p>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground h-12 rounded-xl font-semibold shadow-sm transition hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? 'Please wait…' : children}
    </button>
  );
}

/** Moves focus to the first invalid field after validation fails, so the error is announced. */
export function useFocusFirstInvalid(errors: Record<string, string>) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (Object.keys(errors).length) {
      formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
    }
  }, [errors]);
  return formRef;
}

/** Password input with a show/hide toggle, so people can check what they typed on a phone keyboard. */
export function PasswordField(props: Omit<FieldProps, 'type' | 'children'>) {
  const [visible, setVisible] = useState(false);
  return (
    <Field {...props} type={visible ? 'text' : 'password'} className="pr-12">
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-lg outline-none focus-visible:ring-[3px]"
      >
        {visible ? (
          <EyeOffIcon className="size-5" aria-hidden />
        ) : (
          <EyeIcon className="size-5" aria-hidden />
        )}
      </button>
    </Field>
  );
}

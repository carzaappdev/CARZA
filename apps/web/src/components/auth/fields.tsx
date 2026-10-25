import { useEffect, useRef, type InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
};

export function Field({ label, name, error, hint, ...input }: FieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="border-input bg-background focus-visible:ring-ring aria-invalid:border-destructive h-11 rounded-md border px-3 text-base outline-none focus-visible:ring-2"
        {...input}
      />
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
          ? 'bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm'
          : 'bg-success/10 text-success rounded-md px-3 py-2 text-sm'
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
      className="bg-primary text-primary-foreground h-11 rounded-md font-medium disabled:opacity-60"
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

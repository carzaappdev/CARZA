import type { InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
};

export function Field({ label, name, error, ...input }: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="border-input bg-background focus-visible:ring-ring h-11 rounded-md border px-3 text-base outline-none focus-visible:ring-2 aria-invalid:border-destructive"
        {...input}
      />
      {error ? (
        <p id={errorId} className="text-destructive text-sm">
          {error}
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

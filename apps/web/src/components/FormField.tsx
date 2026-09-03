import { forwardRef, type InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, id, name, ...props },
  ref,
) {
  const fieldId = id ?? name;
  return (
    <label htmlFor={fieldId} className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input
        id={fieldId}
        name={name}
        ref={ref}
        aria-invalid={Boolean(error)}
        className={`rounded-lg border px-3 py-2 outline-none focus:border-ink ${
          error ? 'border-red-400' : 'border-line'
        }`}
        {...props}
      />
      {error && (
        <span role="alert" className="text-red-600">
          {error}
        </span>
      )}
    </label>
  );
});

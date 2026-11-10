import { useId } from 'react';

/**
 * A labelled text input. The label is always visible; the error appears under
 * the field in words. Works with React Hook Form: <Field label="Email" {...register('email')} />
 */
export default function Field({ label, error, hint, className = '', id, ...inputProps }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1 block font-medium text-gray-900">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`block min-h-11 w-full rounded-lg border bg-white px-3 text-base text-gray-900 focus:outline-2 focus:outline-offset-1 focus:outline-brand ${
          error ? 'border-emergency' : 'border-gray-300'
        }`}
        {...inputProps}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${inputId}-hint`} className="mt-1 text-sm text-gray-600">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

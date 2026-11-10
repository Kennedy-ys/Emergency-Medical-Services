import Spinner from './Spinner';

const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  emergency: 'bg-emergency text-white hover:bg-emergency-hover',
  secondary: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
  ghost: 'text-brand hover:bg-brand-tint',
};

const SIZES = {
  md: 'min-h-11 px-4 text-base',
  lg: 'min-h-14 w-full px-6 text-lg',
};

/**
 * @param {{ variant?: 'primary'|'emergency'|'secondary'|'ghost', size?: 'md'|'lg',
 *           loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

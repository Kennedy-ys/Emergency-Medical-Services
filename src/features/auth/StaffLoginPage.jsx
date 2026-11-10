import { Link, Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Field from '../../components/ui/Field';
import { LoadingState } from '../../components/ui/States';
import { useSession } from '../../hooks/useSession';
import { STAFF_ROLES, landingFor } from '../../lib/roles';
import { signInErrorMessage, useStaffSignIn } from './api';

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export default function StaffLoginPage() {
  const { loading, user, isAnonymous, role, signOut } = useSession();
  const location = useLocation();
  const signIn = useStaffSignIn();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const signedIn = Boolean(user) && !isAnonymous;

  if (signedIn && STAFF_ROLES.includes(role)) {
    return <Navigate to={landingFor(role, location.state?.from)} replace />;
  }

  // Someone part-way through a driver application goes back to it after signing in.
  if (signedIn && role === 'patient' && location.state?.from === '/driver/register') {
    return <Navigate to="/driver/register" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff sign in</h1>
        <p className="mt-1 text-gray-600">For drivers, technicians and dispatchers.</p>

        {loading ? (
          <LoadingState className="mt-6" />
        ) : signedIn ? (
          <div className="mt-6">
            <p className="text-gray-900" role="alert">
              This account does not have staff access. Ask a dispatcher to set it up, or sign in
              with a different account.
            </p>
            <p className="mt-2 text-gray-900">
              Ambulance driver?{' '}
              <Link to="/driver/register" className="font-semibold text-brand hover:underline">
                Apply to drive
              </Link>
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            noValidate
            onSubmit={handleSubmit((values) => signIn.mutate(values))}
          >
            <Field
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="username"
              error={errors.email?.message}
              {...register('email')}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            {signIn.isError && (
              <p className="text-red-700" role="alert">
                {signInErrorMessage(signIn.error)}
              </p>
            )}
            <Button type="submit" size="lg" loading={signIn.isPending}>
              Sign in
            </Button>
          </form>
        )}

        {!signedIn && (
          <p className="mt-6 text-gray-600">
            New ambulance driver?{' '}
            <Link to="/driver/register" className="font-semibold text-brand hover:underline">
              Apply to drive
            </Link>
          </p>
        )}
        <p className="mt-2 text-gray-600">
          Need an ambulance?{' '}
          <Link to="/" className="font-semibold text-brand hover:underline">
            Go to the home page
          </Link>
        </p>
      </Card>
    </div>
  );
}

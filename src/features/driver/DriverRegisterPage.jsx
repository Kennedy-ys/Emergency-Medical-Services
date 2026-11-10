import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Field from '../../components/ui/Field';
import { LoadingState } from '../../components/ui/States';
import { useSession } from '../../hooks/useSession';
import { classifyError } from '../../lib/supabase';
import { errorText } from '../../lib/status';
import { signUpErrorMessage, useStaffSignUp } from '../auth/api';
import { useRegisterDriver } from './api';

const accountSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});

const applicationSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(100, 'Name is too long.'),
  phone: z
    .string()
    .transform((value) => value.replace(/[\s()-]/g, ''))
    .pipe(
      z.string().regex(/^\+?\d{10,14}$/, 'Enter a valid phone number, for example 08012345678.')
    ),
  ambulanceNumber: z
    .string()
    .trim()
    .min(1, 'Enter the ambulance number.')
    .max(30, 'Ambulance number is too long.'),
  licensePlate: z
    .string()
    .trim()
    .min(1, 'Enter the licence plate.')
    .max(20, 'Licence plate is too long.'),
});

/** Step 1: an email and password account. */
function AccountForm() {
  const signUp = useStaffSignUp();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(accountSchema), defaultValues: { email: '', password: '' } });

  if (signUp.data?.needsConfirmation) {
    return (
      <div className="mt-6" role="status">
        <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
        <p className="mt-1 text-gray-600">
          We sent a link to confirm your address. Open it on this phone, then continue your
          application.
        </p>
        <Link
          to="/staff/login"
          state={{ from: '/driver/register' }}
          className="mt-4 inline-block font-semibold text-brand hover:underline"
        >
          I have confirmed, sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      className="mt-6 space-y-4"
      noValidate
      onSubmit={handleSubmit((values) => signUp.mutate(values))}
    >
      <p className="font-medium text-gray-900">Step 1 of 2: create your account</p>
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
        autoComplete="new-password"
        hint="At least 8 characters."
        error={errors.password?.message}
        {...register('password')}
      />
      {signUp.isError && (
        <p className="text-red-700" role="alert">
          {signUpErrorMessage(signUp.error)}
        </p>
      )}
      <Button type="submit" size="lg" loading={signUp.isPending}>
        Create account
      </Button>
      <p className="text-gray-600">
        Already started?{' '}
        <Link to="/staff/login" className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/** Step 2: the driver's details, sent for approval. */
function ApplicationForm({ onDone }) {
  const apply = useRegisterDriver();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(applicationSchema),
    defaultValues: { fullName: '', phone: '', ambulanceNumber: '', licensePlate: '' },
  });

  let failure = null;
  if (apply.isError) {
    const { kind, code } = classifyError(apply.error);
    failure =
      kind === 'business'
        ? errorText(code)
        : 'Could not send your application. Check your connection and try again.';
  }

  return (
    <form
      className="mt-6 space-y-4"
      noValidate
      onSubmit={handleSubmit((values) => apply.mutate(values, { onSuccess: onDone }))}
    >
      <p className="font-medium text-gray-900">Step 2 of 2: your details</p>
      <Field
        label="Full name"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <Field
        label="Phone number"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        hint="Patients and dispatch call this number during a trip."
        error={errors.phone?.message}
        {...register('phone')}
      />
      <Field
        label="Ambulance number"
        error={errors.ambulanceNumber?.message}
        {...register('ambulanceNumber')}
      />
      <Field
        label="Licence plate"
        autoCapitalize="characters"
        error={errors.licensePlate?.message}
        {...register('licensePlate')}
      />
      {failure && (
        <p className="text-red-700" role="alert">
          {failure}
        </p>
      )}
      <Button type="submit" size="lg" loading={apply.isPending}>
        Send application
      </Button>
    </form>
  );
}

export default function DriverRegisterPage() {
  const { loading, user, isAnonymous, role, refreshProfile, signOut } = useSession();
  const signedIn = Boolean(user) && !isAnonymous;

  if (signedIn && role === 'driver') return <Navigate to="/driver" replace />;

  let body;
  if (loading) {
    body = <LoadingState className="mt-6" />;
  } else if (!signedIn) {
    body = <AccountForm />;
  } else if (role === 'patient') {
    body = <ApplicationForm onDone={refreshProfile} />;
  } else {
    body = (
      <div className="mt-6">
        <p className="text-gray-900" role="alert">
          This account is already registered as staff and cannot apply as a driver.
        </p>
        <Button variant="secondary" className="mt-4" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-gray-900">Apply to drive</h1>
        <p className="mt-1 text-gray-600">
          For ambulance drivers. A dispatcher approves each application before you can go on duty.
        </p>
        {body}
      </Card>
    </div>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Field from '../../components/ui/Field';
import { LoadingState } from '../../components/ui/States';
import { useSession } from '../../hooks/useSession';
import { homeForRole } from '../../lib/roles';
import { useSetPassword } from './api';

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'The two passwords do not match.',
  });

/** Where an invitation email lands: the new staff member chooses a password. */
export default function StaffWelcomePage() {
  const { loading, user, isAnonymous, role, profile } = useSession();
  const navigate = useNavigate();
  const setPassword = useSetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  const submit = ({ password }) =>
    setPassword.mutate(password, {
      onSuccess: () => {
        toast.success('Password saved.');
        navigate(homeForRole(role), { replace: true });
      },
      onError: (error) =>
        toast.error(
          error?.code === 'weak_password'
            ? 'Choose a longer password.'
            : 'Could not save the password. Check your connection and try again.'
        ),
    });

  let body;
  if (loading) body = <LoadingState />;
  else if (!user || isAnonymous) {
    body = (
      <>
        <h1 className="text-2xl font-bold text-gray-900">This link no longer works</h1>
        <p className="mt-2 text-gray-600">
          Invitation links can be used once and expire after a while. Ask your dispatcher to send a
          new one, or sign in if you have already chosen a password.
        </p>
        <Link to="/staff/login" className="mt-4 inline-block font-semibold text-brand underline">
          Go to sign in
        </Link>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="mt-2 text-gray-600">
          Choose a password. You will use it to sign in from now on.
        </p>
        <form onSubmit={handleSubmit(submit)} noValidate className="mt-4 space-y-3">
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            error={errors.password?.message}
            {...register('password')}
          />
          <Field
            label="Type it again"
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register('confirm')}
          />
          <Button type="submit" size="lg" loading={setPassword.isPending}>
            Save password
          </Button>
        </form>
      </>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <main className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm">{body}</main>
    </div>
  );
}

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoginSchema, type LoginInput } from '@raphael-eventos/shared';
import { api, ApiError } from '../lib/api';
import { AuthCard } from '../components/AuthCard';
import { FormField } from '../components/FormField';
import { SESSION_QUERY_KEY } from '../hooks/useSession';
import { homePathFor } from '../lib/homePath';

export default function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  const mutation = useMutation({
    mutationFn: api.login,
    onSuccess: (data) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, data);
      navigate(homePathFor(data.user));
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'No pudimos iniciar sesión';
      setError('root', { message });
    },
  });

  return (
    <AuthCard
      title="Ingresá a tu cuenta"
      subtitle="Vas a ver tus eventos, tu saldo y tus tarjetas."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        {errors.root?.message && (
          <p role="alert" className="text-sm text-red-600">
            {errors.root.message}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="mt-2 rounded-full bg-ink px-4 py-2.5 text-sm text-white transition hover:bg-black disabled:opacity-60"
        >
          {mutation.isPending ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿No tenés cuenta todavía?{' '}
        <Link to="/registro" className="text-ink underline">
          Creála acá
        </Link>
        .
      </p>
    </AuthCard>
  );
}

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RegisterSchema, type RegisterInput } from '@raphael-eventos/shared';
import { api, ApiError } from '../lib/api';
import { AuthCard } from '../components/AuthCard';
import { FormField } from '../components/FormField';
import { SESSION_QUERY_KEY } from '../hooks/useSession';

export default function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(RegisterSchema) });

  const mutation = useMutation({
    mutationFn: api.register,
    onSuccess: (data) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, data);
      navigate('/portal');
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'No pudimos crear la cuenta';
      setError('root', { message });
    },
  });

  return (
    <AuthCard
      title="Creá tu cuenta"
      subtitle="Usá el mismo email que le diste al salón — así queda vinculada a tus eventos."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <FormField
          label="Nombre completo"
          type="text"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          label="Teléfono (opcional)"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <FormField
          label="Contraseña"
          type="password"
          autoComplete="new-password"
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
          {mutation.isPending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="text-ink underline">
          Ingresá acá
        </Link>
        .
      </p>
    </AuthCard>
  );
}

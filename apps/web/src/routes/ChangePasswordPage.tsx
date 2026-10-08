import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ChangePasswordSchema } from '@raphael-eventos/shared';
import { api, ApiError, type SessionResponse } from '../lib/api';
import { AuthCard } from '../components/AuthCard';
import { FormField } from '../components/FormField';
import { SESSION_QUERY_KEY, useSession } from '../hooks/useSession';
import { homePathFor } from '../lib/homePath';

// El schema compartido valida lo que viaja a la API; la repetición de la
// contraseña es solo del form (no hay recupero por email: un error de tipeo
// obligaría a pedirle al admin un reseteo).
const FormSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((values, ctx) => {
    const parsed = ChangePasswordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) ctx.addIssue(issue);
    }
    if (values.newPassword !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Las contraseñas no coinciden',
        path: ['confirmPassword'],
      });
    }
  });
type FormValues = z.infer<typeof FormSchema>;

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isTemporary = session?.user.mustChangePassword ?? false;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema) });

  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: FormValues) =>
      api.changePassword({ currentPassword, newPassword }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData<SessionResponse | null>(SESSION_QUERY_KEY, (prev) =>
        prev ? { ...prev, user } : prev,
      );
      navigate(homePathFor(user), { replace: true });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'No pudimos cambiar la contraseña';
      setError('root', { message });
    },
  });

  return (
    <AuthCard
      title={isTemporary ? 'Elegí tu contraseña' : 'Cambiar contraseña'}
      subtitle={
        isTemporary
          ? 'Estás usando una contraseña temporal. Reemplazala por una propia para seguir.'
          : undefined
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <FormField
          label={isTemporary ? 'Contraseña temporal' : 'Contraseña actual'}
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <FormField
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <FormField
          label="Repetí la nueva contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
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
          {mutation.isPending ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </AuthCard>
  );
}

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Todos los tests de la API corren contra el MISMO Postgres y el MISMO
    // tenant real (ver CLAUDE.md): en paralelo se pisan entre archivos (ej.
    // admin.test y portal.test crean IPC en 2099 — único por tenant+período —
    // y un índice de 2099 cambia el "último IPC" que ven los demás). En serie.
    fileParallelism: false,
  },
});

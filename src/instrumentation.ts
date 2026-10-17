export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { migrar } = await import('./lib/migraciones');
  await migrar();
}

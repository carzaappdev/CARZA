import 'server-only';
import { validateEnv } from './schema';

// Importing this file from a Client Component is a build error (server-only).
export const serverEnv = validateEnv(process.env);

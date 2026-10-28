import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type { Database } from './database.types';
export { Constants } from './database.types';

/** A Supabase client typed against our schema. Works for the web server/browser clients and Expo. */
export type TypedClient = SupabaseClient<Database>;

type PublicSchema = Database['public'];
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export * from './queries/search';
export * from './queries/listings';
export * from './queries/posts';
export * from './queries/events';
export * from './queries/reels';
export * from './queries/notifications';
export * from './queries/garage';

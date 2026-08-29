import PocketBase from 'pocketbase';
import type { TypedPocketBase } from '../types/pb';

// A single app-wide PocketBase client. In dev the Vite proxy forwards /api and
// /_ to PocketBase; in production PocketBase serves the SPA. A same-origin base
// therefore works in both. Swapping to a typed client keeps collection access
// checked against src/types/pb.ts.
export const pb = new PocketBase('/') as TypedPocketBase;

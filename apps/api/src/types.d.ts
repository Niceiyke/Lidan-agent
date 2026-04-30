import { PrismaClient } from '@prisma/client';
import { SSEBroadcaster } from './sse.js';

export interface AppVariables {
  prisma: PrismaClient;
  sse: SSEBroadcaster;
}

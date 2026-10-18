import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureDatabase, type D1DatabaseLike } from '../db/sqlite';
import { getPasswordVersion, signToken } from '../utils/security';
import { requireAuth, type AuthenticatedRequest } from './auth';

const currentPasswordHash = 'current-password-hash';

function makeRequest(passwordVersion: string): AuthenticatedRequest {
  return {
    headers: {
      authorization: `Bearer ${signToken({
        userId: 'user-1',
        email: 'rider@example.test',
        name: 'Rider',
        passwordVersion,
      })}`,
    },
  } as AuthenticatedRequest;
}

describe('requireAuth', () => {
  beforeEach(() => {
    const database: D1DatabaseLike = {
      prepare() {
        const statement = {
          bind() {
            return statement;
          },
          async all<T>() {
            return { results: [{ password_hash: currentPasswordHash } as T] };
          },
        };
        return statement;
      },
      async exec() {},
    };
    configureDatabase(database);
  });

  it('allows a token that matches the account password version', async () => {
    const request = makeRequest(getPasswordVersion(currentPasswordHash));
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      requireAuth(request, {} as Response, (error?: unknown) => {
        if (error) {
          next(error);
        } else {
          next();
        }
        resolve();
      });
    });

    expect(next).toHaveBeenCalledWith();
    expect(request.user?.id).toBe('user-1');
  });

  it('rejects a token issued before the account password changed', async () => {
    const request = makeRequest(getPasswordVersion('previous-password-hash'));
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      requireAuth(request, {} as Response, (error?: unknown) => {
        next(error);
        resolve();
      });
    });

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      message: 'Your session is no longer valid. Sign in again.',
    }));
  });
});

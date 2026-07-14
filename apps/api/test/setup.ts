import { vi } from "vitest";

const TEST_BCRYPT_ROUNDS = 4;

vi.mock("bcryptjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bcryptjs")>();
  const bcrypt = actual.default;

  const normalizeSaltOrRounds = (value: string | number) => {
    return typeof value === "number" ? Math.min(value, TEST_BCRYPT_ROUNDS) : value;
  };

  const hash = ((
    password: string,
    salt: string | number,
    callback?: Parameters<typeof bcrypt.hash>[2],
    progressCallback?: Parameters<typeof bcrypt.hash>[3],
  ) => {
    const normalizedSalt = normalizeSaltOrRounds(salt);

    if (callback) {
      return bcrypt.hash(password, normalizedSalt, callback, progressCallback);
    }

    return bcrypt.hash(password, normalizedSalt);
  }) as typeof bcrypt.hash;

  const hashSync = ((password: string, salt?: string | number) => {
    return bcrypt.hashSync(
      password,
      typeof salt === "number" ? normalizeSaltOrRounds(salt) : salt,
    );
  }) as typeof bcrypt.hashSync;

  return {
    ...actual,
    default: {
      ...bcrypt,
      hash,
      hashSync,
    },
    hash,
    hashSync,
  };
});

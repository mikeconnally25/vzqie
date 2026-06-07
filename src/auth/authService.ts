import {
  hashPassword,
  validateEmail,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "./password.js";
import { UserStore } from "./userStore.js";
import type { LoginInput, PublicUser, SignupInput } from "./types.js";
import { toPublicUser } from "./types.js";

export class AuthService {
  constructor(private readonly store = new UserStore()) {}

  async signup(input: SignupInput): Promise<PublicUser> {
    const usernameError = validateUsername(input.username);
    if (usernameError) {
      throw new Error(usernameError);
    }

    const passwordError = validatePassword(input.password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    const emailError = validateEmail(input.email);
    if (emailError) {
      throw new Error(emailError);
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.store.createUser(input, passwordHash);
    return toPublicUser(user);
  }

  async login(input: LoginInput): Promise<PublicUser> {
    const user = await this.store.findByUsername(input.username);
    if (!user) {
      throw new Error("Invalid username or password.");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new Error("Invalid username or password.");
    }

    return toPublicUser(user);
  }

  async getUserById(id: string): Promise<PublicUser | null> {
    const user = await this.store.findById(id);
    return user ? toPublicUser(user) : null;
  }

  async countUsers(): Promise<number> {
    return this.store.count();
  }
}

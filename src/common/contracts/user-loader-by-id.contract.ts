import { User } from 'src/modules/auth/entities';

export const USER_LOADER_TOKEN = 'USER_LOADER';

export interface IUserLoaderById {
  execute(id: string): Promise<User | null>;
}

import { Injectable } from '@nestjs/common';
import { IUserLoaderById } from '../../../common/contracts/user-loader-by-id.contract';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class FindUserByIdService implements IUserLoaderById {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) return null;

    return user;
  }
}

import { User } from '../models/user.model.js';

export const userRepository = {
  findByEmail(email: string) {
    return User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  },
  create(input: { name: string; email: string; passwordHash: string }) {
    return User.create({ ...input, email: input.email.toLowerCase(), status: 'active' });
  },
  findActiveById(id: string) {
    return User.findOne({ _id: id, status: 'active' });
  },
};

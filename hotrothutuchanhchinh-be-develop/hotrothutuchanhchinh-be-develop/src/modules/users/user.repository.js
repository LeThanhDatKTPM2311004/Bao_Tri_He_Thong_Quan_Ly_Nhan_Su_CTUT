import User from './user.model.js';

export const findAll = (filter, { skip, limit }) =>
  User.find(filter).select('-password -refreshToken').skip(skip).limit(limit).sort({ createdAt: -1 });

export const count = (filter) => User.countDocuments(filter);

export const findById = (id) => User.findById(id).select('-password -refreshToken');

export const findByIdWithPassword = (id) => User.findById(id).select('+password');

export const findByIdWithAvatarMeta = (id) =>
  User.findById(id).select('-password -refreshToken +avatarPublicId');

export const findByIdWithSignatureMeta = (id) =>
  User.findById(id).select('-password -refreshToken +signatureImagePublicId');

export const findByIdWithGoogleMeta = (id) =>
  User.findById(id).select('-password -refreshToken +googleSub');

export const create = (data) => User.create(data);

export const update = (id, data) =>
  User.findByIdAndUpdate(id, data, { new: true }).select('-password -refreshToken');

export const updateMe = (id, data) =>
  User.findByIdAndUpdate(id, data, { new: true, runValidators: true }).select('-password -refreshToken');

export const unlinkGoogleMeta = (id) =>
  User.findByIdAndUpdate(
    id,
    {
      $unset: { googleSub: 1 },
      $set: {
        googleEmail: null,
        googlePicture: '',
        googleLinkedAt: null,
      },
    },
    { new: true, runValidators: true },
  ).select('-password -refreshToken');

export const remove = (id) => User.findByIdAndUpdate(id, { isActive: false }, { new: true });

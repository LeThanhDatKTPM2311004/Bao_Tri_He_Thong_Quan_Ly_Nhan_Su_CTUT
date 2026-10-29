import { ValidationError } from '../errors/AppError.js';

export const validate = (schema) => (req, _res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    }));
    return next(new ValidationError('Validation failed', details));
  }

  req.body = value;
  next();
};
